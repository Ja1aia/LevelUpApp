-- ==========================================
-- COMPLETE ELO SYSTEM FIX
-- ==========================================
-- This file contains all necessary functions and the trigger
-- to properly calculate and update ELO for BOTH winner and loser

-- ==========================================
-- 1. Helper Function: Get Adaptive K-Factor
-- ==========================================
-- K-factor determines how much ELO changes per game
-- Higher K = more volatile (for new players)
-- Lower K = more stable (for experienced players)

CREATE OR REPLACE FUNCTION public.get_adaptive_k_factor(
  p_games_played INT,
  p_elo INT
)
RETURNS INT
LANGUAGE plpgsql
AS $$
BEGIN
  -- New players (< 30 games): High volatility
  IF p_games_played < 30 THEN
    RETURN 40;
  END IF;

  -- High-rated players (>= 2400): Low volatility
  IF p_elo >= 2400 THEN
    RETURN 10;
  END IF;

  -- Regular players: Medium volatility
  RETURN 20;
END;
$$;

-- ==========================================
-- 2. Core Function: Calculate ELO Change
-- ==========================================
-- This function calculates the ELO rating change
-- Based on the official ELO formula used in chess

CREATE OR REPLACE FUNCTION public.calculate_elo_change(
  p_player_elo INT,
  p_opponent_elo INT,
  p_actual_score FLOAT,  -- 1.0 = win, 0.5 = draw, 0.0 = loss
  p_k_factor INT
)
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
  v_expected_score FLOAT;
  v_elo_change INT;
BEGIN
  -- Calculate expected score using ELO formula
  -- E = 1 / (1 + 10^((opponent_elo - player_elo) / 400))
  v_expected_score := 1.0 / (1.0 + POWER(10.0, (p_opponent_elo - p_player_elo)::FLOAT / 400.0));

  -- Calculate ELO change
  -- Change = K * (Actual - Expected)
  v_elo_change := ROUND(p_k_factor * (p_actual_score - v_expected_score));

  RAISE NOTICE '🧮 ELO Calc - Player: %, Opponent: %, Actual: %, Expected: %, K: %, Change: %',
    p_player_elo, p_opponent_elo, p_actual_score, v_expected_score, p_k_factor, v_elo_change;

  RETURN v_elo_change;
END;
$$;

-- ==========================================
-- 3. Main Trigger Function
-- ==========================================
-- Processes game completion and updates BOTH players' stats

CREATE OR REPLACE FUNCTION public.process_game_completion()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_room rooms%ROWTYPE;
  v_total_questions INT := 5;
  v_player1_score INT := 0;
  v_player2_score INT := 0;
  v_player1_elo INT;
  v_player2_elo INT;
  v_player1_games_played INT;
  v_player2_games_played INT;
  v_player1_k_factor INT;
  v_player2_k_factor INT;
  v_player1_actual FLOAT;
  v_player2_actual FLOAT;
  v_player1_change INT;
  v_player2_change INT;
  v_player1_won BOOLEAN;
  v_player2_won BOOLEAN;
  v_sessions_count INT;
  v_complete_sessions INT;
  v_game_result_exists BOOLEAN;
  v_player1_updated INT;
  v_player2_updated INT;
BEGIN
  RAISE NOTICE '═══════════════════════════════════════════════════';
  RAISE NOTICE '🎬 TRIGGER STARTED for room: %', NEW.room_id;
  RAISE NOTICE '═══════════════════════════════════════════════════';

  -- CRITICAL: Check if game_result already exists FIRST (with lock)
  SELECT EXISTS(
    SELECT 1 FROM game_results
    WHERE room_id = NEW.room_id
    FOR UPDATE NOWAIT
  ) INTO v_game_result_exists;

  IF v_game_result_exists THEN
    RAISE NOTICE '⚠️  Game result already exists for room %, skipping', NEW.room_id;
    RETURN NEW;
  END IF;

  -- Get room info
  SELECT * INTO v_room FROM rooms WHERE id = NEW.room_id;

  IF v_room IS NULL THEN
    RAISE NOTICE '⚠️  Room % is NULL', NEW.room_id;
    RETURN NEW;
  END IF;

  IF v_room.status = 'finished' THEN
    RAISE NOTICE '⚠️  Room % already finished', NEW.room_id;
    RETURN NEW;
  END IF;

  -- Count complete sessions
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE player1_correct IS NOT NULL AND player2_correct IS NOT NULL)
  INTO v_sessions_count, v_complete_sessions
  FROM game_sessions
  WHERE room_id = NEW.room_id;

  RAISE NOTICE '📊 Sessions: %/% complete', v_complete_sessions, v_total_questions;

  -- Check if all questions answered by both players
  IF v_sessions_count < v_total_questions OR v_complete_sessions < v_total_questions THEN
    RAISE NOTICE '⚠️  Not all questions answered yet';
    RETURN NEW;
  END IF;

  RAISE NOTICE '✅ All questions complete, processing game...';

  -- Calculate scores
  SELECT
    COALESCE(SUM(CASE WHEN player1_correct THEN 1 ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN player2_correct THEN 1 ELSE 0 END), 0)
  INTO v_player1_score, v_player2_score
  FROM game_sessions
  WHERE room_id = NEW.room_id;

  RAISE NOTICE '📊 Final Scores - Player1: % | Player2: %', v_player1_score, v_player2_score;

  -- Get current ELO and games played for BOTH players
  SELECT elo, total_games INTO v_player1_elo, v_player1_games_played
  FROM users WHERE id = v_room.host_id;

  SELECT elo, total_games INTO v_player2_elo, v_player2_games_played
  FROM users WHERE id = v_room.guest_id;

  RAISE NOTICE '📈 Player1 (%) - ELO: %, Games: %', v_room.host_id, v_player1_elo, v_player1_games_played;
  RAISE NOTICE '📈 Player2 (%) - ELO: %, Games: %', v_room.guest_id, v_player2_elo, v_player2_games_played;

  -- Calculate adaptive K-factor for each player
  v_player1_k_factor := get_adaptive_k_factor(v_player1_games_played, v_player1_elo);
  v_player2_k_factor := get_adaptive_k_factor(v_player2_games_played, v_player2_elo);

  RAISE NOTICE '⚙️  K-factors - Player1: % | Player2: %', v_player1_k_factor, v_player2_k_factor;

  -- Determine winner and set actual scores
  IF v_player1_score > v_player2_score THEN
    v_player1_actual := 1.0;  -- Player1 wins
    v_player2_actual := 0.0;  -- Player2 loses
    v_player1_won := TRUE;
    v_player2_won := FALSE;
    RAISE NOTICE '🏆 Player1 WINS!';
  ELSIF v_player1_score < v_player2_score THEN
    v_player1_actual := 0.0;  -- Player1 loses
    v_player2_actual := 1.0;  -- Player2 wins
    v_player1_won := FALSE;
    v_player2_won := TRUE;
    RAISE NOTICE '🏆 Player2 WINS!';
  ELSE
    v_player1_actual := 0.5;  -- Draw
    v_player2_actual := 0.5;  -- Draw
    v_player1_won := FALSE;
    v_player2_won := FALSE;
    RAISE NOTICE '🤝 DRAW!';
  END IF;

  -- Calculate ELO changes for BOTH players
  RAISE NOTICE '───────────────────────────────────────────────────';
  RAISE NOTICE '🧮 Calculating ELO changes...';

  v_player1_change := calculate_elo_change(
    v_player1_elo,
    v_player2_elo,
    v_player1_actual,
    v_player1_k_factor
  );

  v_player2_change := calculate_elo_change(
    v_player2_elo,
    v_player1_elo,
    v_player2_actual,
    v_player2_k_factor
  );

  RAISE NOTICE '💰 ELO Changes - Player1: %% | Player2: %%',
    CASE WHEN v_player1_change >= 0 THEN '+' || v_player1_change ELSE v_player1_change::TEXT END,
    CASE WHEN v_player2_change >= 0 THEN '+' || v_player2_change ELSE v_player2_change::TEXT END;

  -- ⭐ CRITICAL: Update player stats FIRST (before INSERT game_results)
  RAISE NOTICE '───────────────────────────────────────────────────';
  RAISE NOTICE '💾 Updating Player Stats...';

  -- Update Player1
  UPDATE users SET
    elo = GREATEST(100, elo + v_player1_change),
    total_games = total_games + 1,
    wins = wins + CASE WHEN v_player1_won THEN 1 ELSE 0 END,
    losses = losses + CASE WHEN v_player2_won THEN 1 ELSE 0 END
  WHERE id = v_room.host_id;

  GET DIAGNOSTICS v_player1_updated = ROW_COUNT;
  RAISE NOTICE '✅ Player1 updated (% rows, new ELO: %)',
    v_player1_updated,
    GREATEST(100, v_player1_elo + v_player1_change);

  -- Update Player2
  UPDATE users SET
    elo = GREATEST(100, elo + v_player2_change),
    total_games = total_games + 1,
    wins = wins + CASE WHEN v_player2_won THEN 1 ELSE 0 END,
    losses = losses + CASE WHEN v_player1_won THEN 1 ELSE 0 END
  WHERE id = v_room.guest_id;

  GET DIAGNOSTICS v_player2_updated = ROW_COUNT;
  RAISE NOTICE '✅ Player2 updated (% rows, new ELO: %)',
    v_player2_updated,
    GREATEST(100, v_player2_elo + v_player2_change);

  -- Verify both players were updated
  IF v_player1_updated = 0 THEN
    RAISE WARNING '❌ Player1 UPDATE affected 0 rows! User might not exist: %', v_room.host_id;
  END IF;

  IF v_player2_updated = 0 THEN
    RAISE WARNING '❌ Player2 UPDATE affected 0 rows! User might not exist: %', v_room.guest_id;
  END IF;

  -- Now insert game result (AFTER updates are done)
  RAISE NOTICE '───────────────────────────────────────────────────';
  RAISE NOTICE '💾 Saving game result...';

  INSERT INTO game_results (
    room_id, winner_id, player1_id, player2_id,
    player1_score, player2_score,
    player1_elo_change, player2_elo_change
  ) VALUES (
    NEW.room_id,
    CASE
      WHEN v_player1_score > v_player2_score THEN v_room.host_id
      WHEN v_player2_score > v_player1_score THEN v_room.guest_id
      ELSE NULL
    END,
    v_room.host_id, v_room.guest_id,
    v_player1_score, v_player2_score,
    v_player1_change, v_player2_change
  )
  ON CONFLICT (room_id) DO NOTHING;

  RAISE NOTICE '✅ Game result saved';

  -- Update room status
  UPDATE rooms SET status = 'finished', finished_at = NOW()
  WHERE id = NEW.room_id AND status != 'finished';

  RAISE NOTICE '═══════════════════════════════════════════════════';
  RAISE NOTICE '🏁 GAME COMPLETION SUCCESS for room %', NEW.room_id;
  RAISE NOTICE '═══════════════════════════════════════════════════';

  RETURN NEW;

EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '═══════════════════════════════════════════════════';
    RAISE WARNING '❌ ERROR in process_game_completion';
    RAISE WARNING '📍 Room: %', NEW.room_id;
    RAISE WARNING '🔥 Error: %', SQLERRM;
    RAISE WARNING '═══════════════════════════════════════════════════';
    RETURN NEW;
END;
$$;

-- ==========================================
-- 4. Verify Trigger is Attached
-- ==========================================
-- Make sure the trigger fires AFTER INSERT OR UPDATE on game_sessions

DROP TRIGGER IF EXISTS trg_game_completion ON game_sessions;

CREATE TRIGGER trg_game_completion
  AFTER INSERT OR UPDATE ON game_sessions
  FOR EACH ROW
  EXECUTE FUNCTION process_game_completion();

-- ==========================================
-- 5. Verification & Testing
-- ==========================================

SELECT 'All ELO functions and trigger created successfully!' as status;

-- Show function signatures
SELECT
  routine_name,
  routine_type,
  data_type as returns
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('get_adaptive_k_factor', 'calculate_elo_change', 'process_game_completion')
ORDER BY routine_name;

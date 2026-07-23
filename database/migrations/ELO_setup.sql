CREATE OR REPLACE FUNCTION public.process_game_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER  -- Ini akan bypass RLS
SET search_path = public
AS $$
DECLARE
  v_room_status TEXT;
  v_host_id UUID;
  v_guest_id UUID;
  v_total_questions CONSTANT INT := 5;
  v_player1_score INT := 0;
  v_player2_score INT := 0;
  v_player1_elo INT;
  v_player2_elo INT;
  v_player1_games INT;
  v_player2_games INT;
  v_player1_k INT;
  v_player2_k INT;
  v_player1_actual FLOAT;
  v_player2_actual FLOAT;
  v_player1_change INT;
  v_player2_change INT;
  v_sessions_count INT;
  v_complete_sessions INT;
  v_updated_rows INT;
BEGIN
  SELECT status, host_id, guest_id
  INTO v_room_status, v_host_id, v_guest_id
  FROM rooms
  WHERE id = NEW.room_id
  FOR UPDATE;
  
  IF v_room_status = 'finished' THEN
    RETURN NEW;
  END IF;

  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE player1_correct IS NOT NULL AND player2_correct IS NOT NULL)
  INTO v_sessions_count, v_complete_sessions
  FROM game_sessions
  WHERE room_id = NEW.room_id;

  IF v_sessions_count < v_total_questions OR v_complete_sessions < v_total_questions THEN
    RETURN NEW;
  END IF;

  UPDATE rooms
  SET status = 'finished', finished_at = NOW()
  WHERE id = NEW.room_id;

  SELECT
    COALESCE(SUM(CASE WHEN player1_correct THEN 1 ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN player2_correct THEN 1 ELSE 0 END), 0)
  INTO v_player1_score, v_player2_score
  FROM game_sessions
  WHERE room_id = NEW.room_id;

  SELECT COALESCE(elo, 1000), COALESCE(total_games, 0)
  INTO v_player1_elo, v_player1_games
  FROM users WHERE id = v_host_id;

  SELECT COALESCE(elo, 1000), COALESCE(total_games, 0)
  INTO v_player2_elo, v_player2_games
  FROM users WHERE id = v_guest_id;

  v_player1_k := get_adaptive_k_factor(v_player1_games, v_player1_elo);
  v_player2_k := get_adaptive_k_factor(v_player2_games, v_player2_elo);

  IF v_player1_score > v_player2_score THEN
    v_player1_actual := 1.0;
    v_player2_actual := 0.0;
  ELSIF v_player1_score < v_player2_score THEN
    v_player1_actual := 0.0;
    v_player2_actual := 1.0;
  ELSE
    v_player1_actual := 0.5;
    v_player2_actual := 0.5;
  END IF;

  v_player1_change := calculate_elo_change(v_player1_elo, v_player2_elo, v_player1_actual, v_player1_k);
  v_player2_change := calculate_elo_change(v_player2_elo, v_player1_elo, v_player2_actual, v_player2_k);

  UPDATE users SET
    elo = GREATEST(100, COALESCE(elo, 1000) + 
      CASE 
        WHEN id = v_host_id THEN v_player1_change
        WHEN id = v_guest_id THEN v_player2_change
      END),
    total_games = COALESCE(total_games, 0) + 1,
    wins = COALESCE(wins, 0) + 
      CASE 
        WHEN id = v_host_id AND v_player1_actual = 1.0 THEN 1
        WHEN id = v_guest_id AND v_player2_actual = 1.0 THEN 1
        ELSE 0
      END,
    losses = COALESCE(losses, 0) + 
      CASE 
        WHEN id = v_host_id AND v_player1_actual = 0.0 THEN 1
        WHEN id = v_guest_id AND v_player2_actual = 0.0 THEN 1
        ELSE 0
      END
  WHERE id IN (v_host_id, v_guest_id);

  INSERT INTO game_results (
    room_id, winner_id, player1_id, player2_id,
    player1_score, player2_score,
    player1_elo_change, player2_elo_change
  ) VALUES (
    NEW.room_id,
    CASE
      WHEN v_player1_score > v_player2_score THEN v_host_id
      WHEN v_player2_score > v_player1_score THEN v_guest_id
      ELSE NULL
    END,
    v_host_id, v_guest_id,
    v_player1_score, v_player2_score,
    v_player1_change, v_player2_change
  )
  ON CONFLICT (room_id) DO NOTHING;

  RETURN NEW;

EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error processing game %: %', NEW.room_id, SQLERRM;
    RETURN NEW;
END;
$$;
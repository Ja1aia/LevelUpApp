-- ==========================================
-- TOURNAMENT TRIGGERS (REFACTORED)
-- ==========================================

-- 1. Helper function to generate next round (Callable manually)
CREATE OR REPLACE FUNCTION generate_next_round(p_tournament_id UUID, p_round_number INTEGER)
RETURNS VOID AS $$
DECLARE
    v_winners UUID[];
    v_next_round INTEGER;
    v_next_matches_count INTEGER;
    i INTEGER;
BEGIN
    -- Get winners for this round
    SELECT array_agg(winner_id ORDER BY match_number)
    INTO v_winners
    FROM public.tournament_matches
    WHERE tournament_id = p_tournament_id 
    AND round_number = p_round_number 
    AND status = 'completed'
    AND winner_id IS NOT NULL;

    -- Safety check
    IF v_winners IS NULL OR array_length(v_winners, 1) IS NULL THEN
        RAISE NOTICE 'No winners found for tournament % round %', p_tournament_id, p_round_number;
        RETURN;
    END IF;

    -- Check if we have a tournament winner (only 1 winner left)
    IF array_length(v_winners, 1) = 1 THEN
        -- Update tournament status
        UPDATE public.tournaments
        SET status = 'completed',
            winner_id = v_winners[1],
            completed_at = timezone('utc'::text, now())
        WHERE id = p_tournament_id;

        -- Update winner's placement
        UPDATE public.tournament_participants
        SET placement = 1
        WHERE tournament_id = p_tournament_id AND user_id = v_winners[1];
        
        RAISE NOTICE 'Tournament % completed. Winner: %', p_tournament_id, v_winners[1];
        RETURN;
    END IF;

    -- Generate next round matches
    v_next_round := p_round_number + 1;
    v_next_matches_count := array_length(v_winners, 1) / 2;

    IF v_next_matches_count < 1 THEN
        RAISE NOTICE 'Not enough winners to generate next round for tournament %', p_tournament_id;
        RETURN;
    END IF;

    FOR i IN 1..v_next_matches_count LOOP
        INSERT INTO public.tournament_matches (
            tournament_id,
            round_number,
            match_number,
            player1_id,
            player2_id,
            status
        ) VALUES (
            p_tournament_id,
            v_next_round,
            i,
            v_winners[(i-1)*2 + 1],
            v_winners[(i-1)*2 + 2],
            'pending'
        )
        ON CONFLICT (tournament_id, round_number, match_number) DO NOTHING; -- Avoid duplicates
    END LOOP;
    
    RAISE NOTICE 'Generated round % for tournament %', v_next_round, p_tournament_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Trigger function
CREATE OR REPLACE FUNCTION handle_match_completion()
RETURNS TRIGGER AS $$
DECLARE
    v_all_completed BOOLEAN;
BEGIN
    -- Only run if status changed to 'completed'
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        
        -- Mark loser as eliminated
        UPDATE public.tournament_participants
        SET is_eliminated = true
        WHERE tournament_id = NEW.tournament_id 
        AND user_id = (CASE WHEN NEW.player1_id = NEW.winner_id THEN NEW.player2_id ELSE NEW.player1_id END);

        -- Check if all matches in this round are completed
        SELECT bool_and(status = 'completed' AND winner_id IS NOT NULL)
        INTO v_all_completed
        FROM public.tournament_matches
        WHERE tournament_id = NEW.tournament_id AND round_number = NEW.round_number;

        -- If round is finished, generate next round
        IF v_all_completed THEN
            PERFORM generate_next_round(NEW.tournament_id, NEW.round_number);
        END IF;

    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Re-create trigger
DROP TRIGGER IF EXISTS trigger_match_completion ON public.tournament_matches;

CREATE TRIGGER trigger_match_completion
AFTER UPDATE ON public.tournament_matches
FOR EACH ROW
EXECUTE FUNCTION handle_match_completion();

-- 4. SELF-HEALING: Fix any currently stuck tournaments
DO $$
DECLARE
    t RECORD;
    r_num INTEGER;
    all_done BOOLEAN;
    next_exists BOOLEAN;
BEGIN
    FOR t IN SELECT id FROM public.tournaments WHERE status = 'in_progress' LOOP
        -- Find latest round
        SELECT MAX(round_number) INTO r_num FROM public.tournament_matches WHERE tournament_id = t.id;
        
        IF r_num IS NOT NULL THEN
            -- Check if fully completed
            SELECT bool_and(status = 'completed' AND winner_id IS NOT NULL) INTO all_done 
            FROM public.tournament_matches 
            WHERE tournament_id = t.id AND round_number = r_num;
            
            IF all_done THEN
                -- Check if next round exists
                SELECT EXISTS(
                    SELECT 1 FROM public.tournament_matches 
                    WHERE tournament_id = t.id AND round_number = r_num + 1
                ) INTO next_exists;
                
                IF NOT next_exists THEN
                    RAISE NOTICE 'Fixing stuck tournament % round %', t.id, r_num;
                    PERFORM generate_next_round(t.id, r_num);
                END IF;
            END IF;
        END IF;
    END LOOP;
END $$;

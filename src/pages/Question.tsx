
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import QuestionCard from '@/components/Quiz/QuestionCard';
import LeaderboardDisplay, { LeaderboardEntry } from '@/components/Quiz/LeaderboardDisplay';
import { useToast } from '@/hooks/use-toast';
import { RealtimeChannel } from '@supabase/supabase-js';
import { Button } from '@/components/ui/button';
import { PostgrestError } from '@supabase/supabase-js';

type Player = { id: string; name: string; /* ... other fields */ };

type QuestionType = {
  id: string;
  question_text: string;
  options: string[];
  correct_option_index: number;
};

// Define game view states
type GameView = 'loading' | 'leaderboard' | 'question' | 'finished' | 'error';

const Question: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Get roomId from location state
  const roomId = location.state?.roomId;
  
  // States
  const [gameView, setGameView] = useState<GameView>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QuestionType[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(30); // 30 second countdown
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([]);
  const [currentPlayerId, setCurrentPlayerId] = useState<string | null>(null);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [playerCount, setPlayerCount] = useState(0); // Add state for player count

  // Use ref to track channel subscription and prevent duplicate subscriptions
  const answerChannelRef = useRef<RealtimeChannel | null>(null); // Add ref for answer channel
  const channelRef = useRef<RealtimeChannel | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const leaderboardTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hostWatchdogIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const stuckTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Load current player ID and check host status
  useEffect(() => {
    if (roomId) {
      const playerId = localStorage.getItem(`ggqt-playerId-${roomId}`);
      const hostId = localStorage.getItem(`ggqt-hostId-${roomId}`);
      console.log(`[Question] Current player ID for room ${roomId}:`, playerId);
      console.log(`[Question] Host ID for room ${roomId}:`, hostId);
      setCurrentPlayerId(playerId);
      setIsHost(playerId === hostId);

      if (!playerId) {
        console.error("[Question] No player ID found in localStorage for this room.");
        toast({ 
          title: "Error", 
          description: "Could not identify player. Returning to home.",
          variant: "destructive"
        });
        navigate('/');
      }
    } else {
      console.error("[Question] No roomId provided in location state");
      toast({ 
        title: "Error", 
        description: "Missing game session data. Returning to home.",
        variant: "destructive"
      });
      navigate('/');
    }
  }, [roomId, navigate, toast]);

  // Function to fetch leaderboard data
  const fetchLeaderboard = useCallback(async () => {
    if (!roomId) return;
    try {
      console.log(`[Question] Fetching leaderboard for room ${roomId}`);
      // Correctly type the RPC call for get_leaderboard
      const { data, error } = await supabase.rpc('get_leaderboard', { p_room_id: roomId });

      if (error) {
        console.error("[Question] Error fetching leaderboard:", error, { data });
        toast({ title: "Leaderboard Error", description: "Could not load scores.", variant: "destructive" });
        setLeaderboardData([]);
      } else {
        console.log("[Question] Leaderboard data:", data);
        setLeaderboardData(data || []);
      }
    } catch (err) {
      console.error("[Question] Unexpected error fetching leaderboard:", err);
      toast({ title: "Leaderboard Error", description: "An unexpected error occurred.", variant: "destructive" });
      setLeaderboardData([]);
    }
  }, [roomId, toast]);

  // Function to fetch player count
  const fetchPlayerCount = useCallback(async () => {
    if (!roomId) return;
    try {
      const { count, error } = await supabase
        .from('players')
        .select('*', { count: 'exact', head: true })
        .eq('room_id', roomId);

      if (error) {
        console.error("[Question] Error fetching player count:", error);
      } else {
        console.log(`[Question] Player count for room ${roomId}: ${count}`);
        setPlayerCount(count ?? 0);
      }
    } catch (err) {
      console.error("[Question] Unexpected error fetching player count:", err);
    }
  }, [roomId]);

  // Fetch initial questions and room data
  const fetchInitialData = useCallback(async () => {
    if (!roomId) {
      console.error("[Question] No roomId provided in location state");
      setErrorMessage("Game session data missing. Please return to the home page.");
      setGameView('error');
      return;
    }

    try {
      console.log(`[Question] Fetching initial data for room ${roomId}`);
      setGameView('loading');

      // 1. Get room details to verify state and current question index
      const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .select('game_state, question_index, code')
        .eq('id', roomId)
        .single();
        
      if (roomError) {
        console.error("[Question] Error fetching room data:", roomError);
        setErrorMessage("Could not load game data");
        setGameView('error');
        return;
      }
      
      console.log(`[Question] Room data:`, roomData);
      
      // Verify room is in question_active state
      if (roomData.game_state !== 'question_active') {
        console.warn(`[Question] Room is not in question_active state: ${roomData.game_state}`);
        if (roomData.game_state === 'finished') {
          setGameView('finished');
          fetchLeaderboard(); // Fetch final leaderboard
        } else {
           toast({ title: "Session Error", description: "Game is not active. Returning to waiting room." });
           navigate(`/room/${roomData.code}`);
        }
        return;
      }
      
      // Set current question index from room data
      const initialQuestionIndex = roomData.question_index || 0;
      setCurrentQuestionIndex(initialQuestionIndex);
      
      // 2. Fetch questions for this room
      const { data: questionData, error: questionError } = await supabase
        .from('questions')
        .select('id, question_text, options, correct_option_index')
        .eq('room_id', roomId)
        .order('question_number', { ascending: true });
        
      if (questionError) {
        console.error("[Question] Error fetching questions:", questionError);
        setErrorMessage("Could not load questions");
        setGameView('error');
        return;
      }
      
      if (!questionData || questionData.length === 0) {
        console.error("[Question] No questions found for this room");
        setErrorMessage("No questions found for this game");
        setGameView('error');
        return;
      }
      
      console.log(`[Question] Loaded ${questionData.length} questions`);
      setQuestions(questionData as QuestionType[]);
      
      // Fetch player count
      await fetchPlayerCount(); // Fetch player count during initial load
      
      // 3. Fetch initial leaderboard
      await fetchLeaderboard();
      
      // Decide whether to show leaderboard or first question
      if (initialQuestionIndex > 0) {
        // If resuming mid-game, show leaderboard first
        setGameView('leaderboard');
        // Host can proceed, others wait
        if (isHost) {
          leaderboardTimeoutRef.current = setTimeout(() => {
             showQuestion();
          }, 5000); // Show leaderboard for 5 seconds before auto-proceeding for host
        }
      } else {
        // If starting from Q1, go straight to question
        showQuestion();
      }
      
    } catch (error) {
      console.error("[Question] Unexpected error:", error);
      setErrorMessage("An unexpected error occurred");
      setGameView('error');
    }
  }, [roomId, navigate, toast, fetchLeaderboard, isHost, fetchPlayerCount]);
  
  // Initial data load
  useEffect(() => {
    if (roomId && currentPlayerId) { // Ensure playerId is loaded before fetching
      fetchInitialData();
    }
    // Cleanup timeouts on unmount
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (leaderboardTimeoutRef.current) clearTimeout(leaderboardTimeoutRef.current);
    }
  }, [fetchInitialData, roomId, currentPlayerId]); // Add currentPlayerId dependency
  
  const showQuestion = useCallback(() => {
      if (leaderboardTimeoutRef.current) clearTimeout(leaderboardTimeoutRef.current);
      setGameView('question');
      setTimeRemaining(30); // Reset timer
      setHasAnswered(false);
      setSelectedAnswer(null);

      // Start the timer
      if (timerRef.current) clearInterval(timerRef.current); // Clear existing timer
      timerRef.current = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current as NodeJS.Timeout);
            if (!hasAnswered) {
              console.log("[Question] Time's up! Auto-submitting timeout.");
              handleAnswer(-1); // Auto-submit timeout answer
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
  }, [hasAnswered]); // Add hasAnswered dependency
  
  // Set up realtime subscription for room updates
  useEffect(() => {
    if (!roomId) return;
    
    // Prevent duplicate subscriptions
    if (channelRef.current && channelRef.current.state === 'joined') {
      console.log('[Question Realtime] Channel already joined, skipping setup');
      return;
    }
    
    console.log(`[Question Realtime] Setting up subscription for room updates for room ${roomId}`);
    const channelName = `room-${roomId}`;
    const channel: RealtimeChannel = supabase.channel(channelName, {
      config: { broadcast: { self: true } }
    });
    
    channel
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'rooms',
        filter: `id=eq.${roomId}`
      }, async (payload) => {
        console.log('[Question Realtime] Room update received:', payload);
        
        if (payload.new && typeof payload.new.game_state === 'string') {
          const newGameState = payload.new.game_state;
          const newQuestionIndex = payload.new.question_index;
          
          console.log(`[Question Realtime] Game state: ${newGameState}, Question index: ${newQuestionIndex}`);

          // Clear any existing leaderboard timeout when a new room update comes in
          if (leaderboardTimeoutRef.current) {
              clearTimeout(leaderboardTimeoutRef.current);
              leaderboardTimeoutRef.current = null;
          }

          if (newGameState === 'showing_leaderboard') {
            console.log('[Question Realtime] State is showing_leaderboard. Fetching leaderboard.');
            // Stop current question timer if it's running (e.g., if host finished early)
            if (timerRef.current) clearInterval(timerRef.current);
            await fetchLeaderboard(); // Fetch the latest scores
            setGameView('leaderboard');
            // Set timer ONLY for the host to advance to the next question
            if (isHost) {
              console.log('[Question Realtime] Host starting 5s timer to advance from leaderboard...');
              leaderboardTimeoutRef.current = setTimeout(() => {
                console.log('[Question Realtime] Host timer expired. Calling moveToNextQuestion.');
                moveToNextQuestion(); 
              }, 5000); // 5-second leaderboard display
            }

          } else if (newGameState === 'question_active' && typeof newQuestionIndex === 'number') {
            // This case handles the transition *from* the leaderboard *to* the next question
            // It's triggered when the host calls moveToNextQuestion, updating the index.
            if (newQuestionIndex !== currentQuestionIndex) {
              console.log(`[Question Realtime] New question index ${newQuestionIndex} detected. Showing question.`);
              setCurrentQuestionIndex(newQuestionIndex);
              // Directly show the question - leaderboard was shown previously by 'showing_leaderboard' state
              showQuestion(); 
            } else {
              // If index hasn't changed but state is question_active (e.g. initial load), ensure question is shown
              if (gameView !== 'question') {
                console.log('[Question Realtime] State is question_active, ensuring question view.');
                showQuestion();
              }
            }
          } else if (newGameState === 'finished') {
             console.log('[Question Realtime] Game finished state received.');
             if (timerRef.current) clearInterval(timerRef.current);
             await fetchLeaderboard(); // Fetch final leaderboard
             setGameView('finished');
             toast({ title: "Game Over!", description: "Check the final scores." });
          } else if (newGameState === 'lobby' || newGameState === 'preparing') {
             // Handle unexpected return to lobby/preparing state (e.g., error recovery)
             console.warn(`[Question Realtime] Room unexpectedly returned to state: ${newGameState}. Returning to waiting room.`);
             toast({ title: "Session Error", description: "Game session interrupted. Returning to waiting room.", variant: "destructive" });
             const { data: roomCodeData } = await supabase.from('rooms').select('code').eq('id', roomId).single();
             navigate(`/room/${roomCodeData?.code || ''}`);
          }
        }
      })
      // No need to subscribe to player changes here anymore, leaderboard handles scores
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log(`[Question Realtime] Successfully subscribed to ${channelName} updates`);
          channelRef.current = channel;
        } else if (status === 'CLOSED') {
          console.log(`[Question Realtime] Channel ${channelName} closed.`);
          channelRef.current = null;
        } else {
          console.error(`[Question Realtime] Subscription error:`, status, err);
          channelRef.current = null; // Reset ref on error
        }
      });
    
    // Cleanup function
    return () => {
      if (channelRef.current) {
        console.log(`[Question Realtime] Cleaning up channel ${channelName}`);
        supabase.removeChannel(channelRef.current)
          .then(() => console.log(`[Question Realtime] Removed channel ${channelName}`))
          .catch(err => console.error(`[Question Realtime] Error removing channel ${channelName}:`, err));
        channelRef.current = null;
      }
      // Clear timers on unmount/cleanup
      if (timerRef.current) clearInterval(timerRef.current);
      if (leaderboardTimeoutRef.current) clearTimeout(leaderboardTimeoutRef.current);
    };
  }, [roomId, currentQuestionIndex, fetchLeaderboard, isHost, showQuestion, toast, navigate]); // Add dependencies
  
  // Handle answer selection
  const handleAnswer = async (answerIndex: number) => {
    if (hasAnswered || !currentPlayerId || !roomId || gameView !== 'question') return;
    
    // Stop the timer immediately
    if (timerRef.current) clearInterval(timerRef.current);

    try {
      setHasAnswered(true);
      setSelectedAnswer(answerIndex);
      
      const currentQuestion = questions[currentQuestionIndex];
      if (!currentQuestion) {
        console.error("[Question] Current question not found during answer handling");
        return;
      }
      
      const timeTakenMs = (30 - timeRemaining) * 1000; // Calculate time taken
      const isCorrect = answerIndex === currentQuestion.correct_option_index;
      
      console.log(`[Question] Answer submitted: option ${answerIndex}, correct: ${isCorrect}, time: ${timeTakenMs}ms`);
      
      // Record answer only if it wasn't a timeout (-1)
      if (answerIndex !== -1) {
        const { error: answerError } = await supabase
          .from('answers')
          .insert({
            player_id: currentPlayerId,
            question_id: currentQuestion.id,
            selected_option_index: answerIndex,
            time_taken_ms: timeTakenMs,
            is_correct: isCorrect
          });
        
        if (answerError) {
          console.error("[Question] Error recording answer:", answerError);
          toast({ title: "Error", description: "Could not submit your answer", variant: "destructive" });
          // Don't proceed if the answer couldn't be saved
          setHasAnswered(false); // Allow retry? Maybe better to show error state.
          setSelectedAnswer(null);
          // Consider re-enabling timer? Or just show an error message?
          return; 
        } else {
           toast({ 
            title: isCorrect ? "Correct!" : "Incorrect",
            description: isCorrect
              ? `Good job! You answered in ${(timeTakenMs / 1000).toFixed(1)} seconds.`
              : "Better luck next time!",
            variant: isCorrect ? "default" : "destructive"
          });
        }
      } else {
          toast({ title: "Time's Up!", description: "No answer was submitted in time.", variant: "destructive" });
      }

      console.log(`[Question] Answer processed for player ${currentPlayerId}. Waiting for others or host action.`);

    } catch (error) {
      console.error("[Question] Error in handleAnswer:", error);
      toast({ title: "Error", description: "An unexpected error occurred while submitting.", variant: "destructive" });
      // Reset state on unexpected error
      setHasAnswered(false);
      setSelectedAnswer(null);
    }
  };
  
  // Function to move to next question (host only)
  const moveToNextQuestion = async () => {
    if (!roomId || !isHost) {
      console.log("[Question] Cannot advance: not host or no room ID");
      return; 
    }
    
    try {
      const nextIndex = currentQuestionIndex + 1;
      
      // Check if that was the last question
      if (nextIndex >= questions.length) {
        console.log("[Question] Host advancing: That was the last question. Ending game.");
        // Update room to finished state - this triggers realtime update for all players
        const { error: finishError } = await supabase
          .from('rooms')
          .update({ game_state: 'finished' })
          .eq('id', roomId);
          
        if (finishError) {
          console.error("[Question] Error setting game to finished:", finishError);
          throw finishError;
        }
        
        console.log("[Question] Successfully updated room to finished state");
        // No need to navigate here, realtime handles it
        return;
      }
      
      console.log(`[Question] Host advancing: Moving to next question index: ${nextIndex}`);
      // Update room with next question index and state back to question_active - BOTH values explicitly set
      const { data, error: updateError } = await supabase
        .from('rooms')
        .update({ 
          question_index: nextIndex,
          game_state: 'question_active'
        })
        .eq('id', roomId)
        .select();

      if (updateError) {
        console.error("[Question] Error updating room for next question:", updateError);
        throw updateError;
      }
      
      console.log("[Question] Successfully updated room:", data);
      // State updates will happen via the realtime listener

    } catch (error) {
      console.error("[Question] Error moving to next question:", error);
      toast({ title: "Error", description: "Could not advance the game.", variant: "destructive" });
    }
  };

  // Set up host-only listener for tracking answers and advancing the game
  useEffect(() => {
    // Only the host needs to listen for answers and manage game state
    if (!isHost || !roomId || !currentPlayerId) {
      console.log(`[Question Host Listener] Not setting up: isHost=${isHost}, roomId=${roomId}, currentPlayerId=${currentPlayerId}`);
      return;
    }
    
    const setupAnswerListener = async () => {
      if (!questions[currentQuestionIndex]) {
        console.error("[Question Host Listener] Cannot set up answer listener: Current question not found");
        return;
      }
      
      const currentQuestionId = questions[currentQuestionIndex].id;
      console.log(`[Question Host Listener] Setting up answer listener for question ${currentQuestionId} (index ${currentQuestionIndex})`);
      
      // Unsubscribe from previous answer channel if exists
      if (answerChannelRef.current) {
        console.log(`[Question Host Listener] Unsubscribing from previous answer channel`);
        supabase.removeChannel(answerChannelRef.current);
        answerChannelRef.current = null;
      }
      
      // Create a unique channel name for this question's answers
      const answerChannelName = `answers-for-q${currentQuestionId}-${Date.now()}`;
      
      // Set up the realtime subscription to listen for answers
      const answerChannel = supabase.channel(answerChannelName);
      
      answerChannel
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'answers',
            filter: `question_id=eq.${currentQuestionId}`,
          },
          async (payload) => {
            console.log(`[Question Host Listener] Answer insert detected for question ${currentQuestionId}:`, payload);
            
            try {
              // Fetch the most current room state first
              const { data: roomData, error: roomError } = await supabase
                .from('rooms')
                .select('game_state')
                .eq('id', roomId)
                .single();
                
              if (roomError) {
                console.error("[Question Host Listener] Error fetching room state:", roomError);
                return;
              }
              
              // Skip if room is already in leaderboard or finished state
              if (roomData.game_state === 'showing_leaderboard' || roomData.game_state === 'finished') {
                console.log(`[Question Host Listener] Room already in ${roomData.game_state} state, skipping answer check`);
                return;
              }
              
              // Get latest player count (in case players left/joined)
              const { count: latestPlayerCount, error: playerCountError } = await supabase
                .from('players')
                .select('*', { count: 'exact', head: true })
                .eq('room_id', roomId);
                
              if (playerCountError) {
                console.error("[Question Host Listener] Error fetching player count:", playerCountError);
                return;
              }
              
              const playerCount = latestPlayerCount || 0;
              
              // Count current answers for this question
              const { count: answerCount, error: countError } = await supabase
                .from('answers')
                .select('*', { count: 'exact', head: true })
                .eq('question_id', currentQuestionId);
                
              if (countError) {
                console.error("[Question Host Listener] Error counting answers:", countError);
                return;
              }
              
              console.log(`[Question Host Listener] Current answer count: ${answerCount}/${playerCount} for question ${currentQuestionId}`);
              
              // If all players have answered, update game state to show leaderboard
              if (answerCount !== null && answerCount >= playerCount && playerCount > 0) {
                console.log(`[Question Host Listener] All ${playerCount} players have answered. Transitioning to leaderboard.`);
                
                // Unsubscribe from this question's answers channel
                if (answerChannelRef.current) {
                  console.log(`[Question Host Listener] Unsubscribing from ${answerChannelName}`);
                  supabase.removeChannel(answerChannelRef.current);
                  answerChannelRef.current = null;
                }
                
                // Update room state to show leaderboard for all players
                const { error: updateError } = await supabase
                  .from('rooms')
                  .update({ game_state: 'showing_leaderboard' })
                  .eq('id', roomId);
                  
                if (updateError) {
                  console.error("[Question Host Listener] Error updating room to showing_leaderboard:", updateError);
                  toast({ title: "Error", description: "Could not proceed to leaderboard.", variant: "destructive" });
                } else {
                  console.log("[Question Host Listener] Successfully updated room state to showing_leaderboard");
                  
                  // After a short delay, move to the next question automatically
                  console.log("[Question Host Listener] Setting 5s timer to move to next question");
                  setTimeout(async () => {
                    const nextIndex = currentQuestionIndex + 1;
                    if (nextIndex >= questions.length) {
                      console.log("[Question Host Listener] Last question completed. Setting game to finished.");
                      
                      const { error: finishError } = await supabase
                        .from('rooms')
                        .update({ game_state: 'finished' })
                        .eq('id', roomId);
                        
                      if (finishError) {
                        console.error("[Question Host Listener] Error setting game to finished:", finishError);
                        toast({ title: "Error", description: "Could not finish the game.", variant: "destructive" });
                      } else {
                        console.log("[Question Host Listener] Game successfully finished");
                      }
                    } else {
                      console.log(`[Question Host Listener] Moving to next question ${nextIndex}`);
                      
                      // Use upsert with explicit values to ensure both fields are updated
                      const { error: nextQuestionError } = await supabase
                        .from('rooms')
                        .update({ 
                          question_index: nextIndex,
                          game_state: 'question_active'
                        })
                        .eq('id', roomId);
                        
                      if (nextQuestionError) {
                        console.error("[Question Host Listener] Error updating to next question:", nextQuestionError);
                        toast({ title: "Error", description: "Could not proceed to next question.", variant: "destructive" });
                      } else {
                        console.log(`[Question Host Listener] Successfully moved to question ${nextIndex}`);
                      }
                    }
                  }, 5000); // 5 second delay before moving to next question
                }
              }
            } catch (error) {
              console.error("[Question Host Listener] Error processing answer:", error);
            }
          }
        )
        .subscribe((status, err) => {
          if (status === 'SUBSCRIBED') {
            console.log(`[Question Host Listener] Successfully subscribed to ${answerChannelName}`);
            answerChannelRef.current = answerChannel;
          } else {
            console.error(`[Question Host Listener] Subscription error for ${answerChannelName}:`, status, err);
          }
        });
    };
    
    // If game view is 'question', set up the answer listener
    if (gameView === 'question') {
      console.log("[Question Host Listener] Game view is 'question', setting up answer listener");
      setupAnswerListener();
    } else {
      console.log(`[Question Host Listener] Game view is '${gameView}', not setting up answer listener`);
    }
    
    // Cleanup on unmount or when dependencies change
    return () => {
      if (answerChannelRef.current) {
        console.log("[Question Host Listener] Cleaning up answer channel on effect change/unmount");
        supabase.removeChannel(answerChannelRef.current);
        answerChannelRef.current = null;
      }
    };
  }, [roomId, currentPlayerId, isHost, currentQuestionIndex, questions, gameView, toast]);

  // Set up room-wide realtime listener for game state changes
  useEffect(() => {
    if (!roomId) {
      console.log("[Question Room Listener] No roomId, not setting up listener");
      return;
    }
    
    if (channelRef.current) {
      console.log("[Question Room Listener] Channel already exists, not creating a new one");
      return; // Avoid duplicate subscriptions
    }
    
    const channelName = `room-updates-${roomId}-${Date.now()}`;
    console.log(`[Question Room Listener] Setting up realtime subscription for ${channelName}`);
    
    const channel = supabase.channel(channelName, {
      config: {
        broadcast: { self: true },
        presence: { key: currentPlayerId || 'anonymous' },
      }
    });
    
    channel
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'rooms',
          filter: `id=eq.${roomId}`,
        },
        async (payload) => {
          console.log('[Question Room Listener] Room update received:', payload);
          
          if (!payload.new) {
            console.error('[Question Room Listener] Invalid payload received:', payload);
            return;
          }
          
          const newGameState = payload.new.game_state;
          const newQuestionIndex = payload.new.question_index;
          
          console.log(`[Question Room Listener] Room state updated to: ${newGameState}, question index: ${newQuestionIndex}, current index: ${currentQuestionIndex}`);
          
          // Handle game state transitions
          if (newGameState === 'showing_leaderboard') {
            console.log('[Question Room Listener] Leaderboard state received, changing view and fetching data');
            
            // Clear any active timer
            if (timerRef.current) {
              console.log('[Question Room Listener] Clearing active timer');
              clearInterval(timerRef.current);
              timerRef.current = null;
            }
            
            try {
              // Fetch and display leaderboard
              console.log('[Question Room Listener] Fetching leaderboard data');
              await fetchLeaderboard();
              console.log('[Question Room Listener] Setting game view to leaderboard');
              setGameView('leaderboard');
            } catch (error) {
              console.error('[Question Room Listener] Error handling leaderboard state:', error);
              toast({ 
                title: "Error", 
                description: "Failed to load leaderboard", 
                variant: "destructive" 
              });
            }
          }
          else if (newGameState === 'question_active') {
            // Check if question index actually changed
            if (newQuestionIndex !== currentQuestionIndex) {
              console.log(`[Question Room Listener] Moving to question index ${newQuestionIndex} from ${currentQuestionIndex}`);
              
              // Update local state
              setCurrentQuestionIndex(newQuestionIndex);
              setHasAnswered(false);
              setSelectedAnswer(null);
              
              // Show new question
              console.log('[Question Room Listener] Setting game view to question');
              setGameView('question');
              setTimeRemaining(30); // Reset timer
              
              // Start timer for the new question
              if (timerRef.current) {
                console.log('[Question Room Listener] Clearing existing timer');
                clearInterval(timerRef.current);
              }
              
              console.log('[Question Room Listener] Starting new 30-second timer');
              timerRef.current = setInterval(() => {
                setTimeRemaining(prev => {
                  if (prev <= 1) {
                    console.log('[Question Room Listener] Timer expired');
                    clearInterval(timerRef.current as NodeJS.Timeout);
                    
                    if (!hasAnswered) {
                      console.log('[Question Room Listener] Auto-submitting timeout answer');
                      handleAnswer(-1); // Auto-submit timeout answer
                    }
                    return 0;
                  }
                  return prev - 1;
                });
              }, 1000);
            } else {
              console.log(`[Question Room Listener] Question index ${newQuestionIndex} didn't change, no action needed`);
            }
          }
          else if (newGameState === 'finished') {
            console.log('[Question Room Listener] Game finished state received');
            
            if (timerRef.current) {
              console.log('[Question Room Listener] Clearing timer');
              clearInterval(timerRef.current);
              timerRef.current = null;
            }
            
            try {
              console.log('[Question Room Listener] Fetching final leaderboard');
              await fetchLeaderboard(); // Fetch final leaderboard
              console.log('[Question Room Listener] Setting game view to finished');
              setGameView('finished');
              toast({ title: "Game Over!", description: "Check the final scores." });
            } catch (error) {
              console.error('[Question Room Listener] Error handling finished state:', error);
              toast({ 
                title: "Error", 
                description: "Failed to load final results", 
                variant: "destructive" 
              });
            }
          } else {
            console.log(`[Question Room Listener] Unhandled game state: ${newGameState}`);
          }
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log(`[Question Room Listener] Successfully subscribed to ${channelName}`);
          channelRef.current = channel;
        } else if (status === 'CHANNEL_ERROR') {
          console.error(`[Question Room Listener] Channel error:`, err);
          channelRef.current = null;
          
          // Try to reconnect after a delay
          setTimeout(() => {
            console.log('[Question Room Listener] Attempting to reconnect after error');
            channelRef.current = null; // Force recreation of channel
          }, 2000);
        } else if (status === 'CLOSED') {
          console.log(`[Question Room Listener] Channel ${channelName} closed`);
          channelRef.current = null;
        } else if (status === 'TIMED_OUT') {
          console.error(`[Question Room Listener] Channel timed out:`, err);
          channelRef.current = null;
        } else {
          console.log(`[Question Room Listener] Subscription status: ${status}`, err);
        }
      });
      
    // Cleanup on unmount
    return () => {
      if (channelRef.current) {
        console.log(`[Question Room Listener] Cleaning up channel ${channelName}`);
        supabase.removeChannel(channelRef.current)
          .then(() => console.log(`[Question Room Listener] Successfully removed channel ${channelName}`))
          .catch(err => console.error(`[Question Room Listener] Error removing channel:`, err));
        channelRef.current = null;
      }
    };
  }, [roomId, currentQuestionIndex, currentPlayerId, fetchLeaderboard, hasAnswered, handleAnswer, toast]);
  
  // --- Host Watchdog: Fallback interval to check for answer completion ---
  useEffect(() => {
    if (!isHost || !roomId || questions.length === 0 || currentQuestionIndex >= questions.length) {
      if (hostWatchdogIntervalRef.current) {
        clearInterval(hostWatchdogIntervalRef.current);
        hostWatchdogIntervalRef.current = null;
      }
      return;
    }
    // Only run watchdog during question phase
    if (gameView !== 'question') {
      if (hostWatchdogIntervalRef.current) {
        clearInterval(hostWatchdogIntervalRef.current);
        hostWatchdogIntervalRef.current = null;
      }
      return;
    }
    // Start watchdog
    if (!hostWatchdogIntervalRef.current) {
      hostWatchdogIntervalRef.current = setInterval(async () => {
        try {
          const currentQuestionId = questions[currentQuestionIndex].id;
          // Always fetch latest player count
          const { count: latestPlayerCount, error: pcError } = await supabase
            .from('players')
            .select('*', { count: 'exact', head: true })
            .eq('room_id', roomId);
          if (pcError) {
            console.error('[Host Watchdog] Error fetching player count:', pcError);
            return;
          }
          // Count answers
          const { count: answerCount, error: aError } = await supabase
            .from('answers')
            .select('*', { count: 'exact', head: true })
            .eq('question_id', currentQuestionId);
          if (aError) {
            console.error('[Host Watchdog] Error counting answers:', aError);
            return;
          }
          console.log(`[Host Watchdog] answerCount=${answerCount}, playerCount=${latestPlayerCount}`);
          if (answerCount !== null && latestPlayerCount !== null && answerCount >= latestPlayerCount) {
            // Double-check room state before updating
            const { data: roomData, error: roomError } = await supabase
              .from('rooms')
              .select('game_state')
              .eq('id', roomId)
              .single();
            if (roomError) {
              console.error('[Host Watchdog] Error fetching room state:', roomError);
              return;
            }
            if (roomData.game_state === 'question_active') {
              console.warn('[Host Watchdog] All answers in, but state not updated. Forcing leaderboard.');
              await supabase.from('rooms').update({ game_state: 'showing_leaderboard' }).eq('id', roomId);
            }
          }
        } catch (err) {
          console.error('[Host Watchdog] Unexpected error:', err);
        }
      }, 2000); // Every 2 seconds
    }
    // Cleanup
    return () => {
      if (hostWatchdogIntervalRef.current) {
        clearInterval(hostWatchdogIntervalRef.current);
        hostWatchdogIntervalRef.current = null;
      }
    };
  }, [isHost, roomId, questions, currentQuestionIndex, gameView]);

  // --- Client Watchdog: Timeout after answering to detect stuck state ---
  useEffect(() => {
    if (gameView === 'question' && hasAnswered) {
      if (stuckTimeoutRef.current) clearTimeout(stuckTimeoutRef.current);
      stuckTimeoutRef.current = setTimeout(async () => {
        // If still in question view after 40s, refetch room state
        if (gameView === 'question') {
          console.warn('[Client Watchdog] Stuck in question view after answering. Refetching room state.');
          try {
            const { data: roomData, error: roomError } = await supabase
              .from('rooms')
              .select('game_state, question_index, code')
              .eq('id', roomId)
              .single();
            if (roomError) {
              setErrorMessage('Could not refresh game state.');
              setGameView('error');
              return;
            }
            if (roomData.game_state === 'showing_leaderboard') {
              setGameView('leaderboard');
              await fetchLeaderboard();
            } else if (roomData.game_state === 'finished') {
              setGameView('finished');
              await fetchLeaderboard();
            } else if (roomData.game_state === 'question_active') {
              // If question index changed, show new question
              if (roomData.question_index !== currentQuestionIndex) {
                setCurrentQuestionIndex(roomData.question_index);
                setHasAnswered(false);
                setSelectedAnswer(null);
                setGameView('question');
              }
            } else {
              setErrorMessage('Game session is in an unexpected state.');
              setGameView('error');
            }
          } catch (err) {
            setErrorMessage('Unexpected error while checking game state.');
            setGameView('error');
          }
        }
      }, 40000); // 40 seconds
    } else {
      if (stuckTimeoutRef.current) clearTimeout(stuckTimeoutRef.current);
    }
    // Cleanup
    return () => {
      if (stuckTimeoutRef.current) clearTimeout(stuckTimeoutRef.current);
    };
  }, [gameView, hasAnswered, roomId, currentQuestionIndex, fetchLeaderboard]);
  
  // Add a debug utility function
  const checkRoomState = useCallback(async () => {
    if (!roomId) return null;
    
    try {
      const { data, error } = await supabase
        .from('rooms')
        .select('game_state, question_index')
        .eq('id', roomId)
        .single();
        
      if (error) {
        console.error('[Debug] Error fetching room state:', error);
        return null;
      }
      
      console.log('[Debug] Current room state from database:', data);
      return data;
    } catch (err) {
      console.error('[Debug] Unexpected error checking room state:', err);
      return null;
    }
  }, [roomId]);

  // Debug panel for host
  const DebugPanel = () => {
    // Only render for host and in development
    if (!isHost || process.env.NODE_ENV === 'production') return null;
    
    return (
      <div className="fixed bottom-4 right-4 p-4 bg-slate-800 text-white rounded shadow-lg opacity-80 hover:opacity-100 transition-opacity z-50 text-xs">
        <div className="mb-2">
          <strong>Debug Panel</strong> (Host Only)
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          <div>Room ID:</div>
          <div>{roomId?.substring(0, 8)}</div>
          
          <div>View:</div>
          <div>{gameView}</div>
          
          <div>Q Index:</div>
          <div>{currentQuestionIndex} / {questions.length}</div>
          
          <div>Players:</div>
          <div>{playerCount}</div>
        </div>
        <div className="mt-2 flex gap-2">
          <button 
            className="px-2 py-1 bg-blue-500 rounded text-xs"
            onClick={async () => {
              const state = await checkRoomState();
              toast({
                title: "Room State", 
                description: `State: ${state?.game_state}, Question: ${state?.question_index}`
              });
            }}
          >
            Check DB
          </button>
          
          <button 
            className="px-2 py-1 bg-amber-500 rounded text-xs"
            onClick={async () => {
              if (gameView === 'question') {
                const { error } = await supabase
                  .from('rooms')
                  .update({ game_state: 'showing_leaderboard' })
                  .eq('id', roomId);
                  
                if (error) {
                  console.error('[Debug] Error setting leaderboard state:', error);
                  toast({ title: "Error", description: "Failed to update state", variant: "destructive" });
                } else {
                  console.log('[Debug] Manually triggered leaderboard state');
                }
              }
            }}
          >
            Show LB
          </button>
          
          <button 
            className="px-2 py-1 bg-green-500 rounded text-xs"
            onClick={moveToNextQuestion}
          >
            Next Q
          </button>
        </div>
      </div>
    );
  };

  // Render based on gameView state
  const renderContent = () => {
    switch (gameView) {
      case 'loading':
        return (
          <div className="text-center">
            <div className="animate-pulse text-xl font-medium">Loading Game...</div>
          </div>
        );
      case 'error':
        return (
          <div className="text-center">
            <div className="text-xl font-medium text-destructive mb-4">{errorMessage || 'An Error Occurred'}</div>
            <Button onClick={() => navigate('/')}>Return Home</Button>
          </div>
        );
      case 'leaderboard':
        // The timer logic is now handled by the realtime listener effect for the host
        return (
          <div className="flex flex-col items-center space-y-4 w-full max-w-xl animate-fade-in">
             <LeaderboardDisplay 
               leaderboardData={leaderboardData} 
               currentUserId={currentPlayerId}
               title="Current Standings"
             />
             {/* Show appropriate message */} 
             {isHost ? (
                <p className="text-muted-foreground">Next question starting in a few seconds...</p> 
             ) : (
                <p className="text-muted-foreground">Waiting for next question...</p>
             )}
          </div>
        );
       case 'question': {
         const currentQuestion = questions[currentQuestionIndex];
         if (!currentQuestion) {
            // This should ideally not happen if loading logic is correct
            setErrorMessage("Question data is missing.");
            setGameView('error');
            return null; 
         }
         return (
           <QuestionCard
             question={currentQuestion.question_text}
             options={currentQuestion.options}
             timeRemaining={timeRemaining}
             onSelectOption={handleAnswer}
             selectedOption={selectedAnswer}
             correctOptionIndex={hasAnswered ? currentQuestion.correct_option_index : undefined}
             questionNumber={currentQuestionIndex + 1}
             totalQuestions={questions.length}
           />
         );
       }
       case 'finished':
          return (
            <div className="flex flex-col items-center space-y-4">
              <LeaderboardDisplay 
                leaderboardData={leaderboardData} 
                currentUserId={currentPlayerId}
                title="Final Results"
              />
              <Button onClick={() => navigate('/')}>Back to Home</Button>
            </div>
          );
       default:
         return <div>Unexpected State</div>; 
    }
  };
  
  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-gradient-to-b from-purple-50 to-white dark:from-gray-900 dark:to-gray-800">
      {renderContent()}
      <DebugPanel />
    </div>
  );
};

export default Question;

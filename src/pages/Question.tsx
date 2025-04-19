
import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import QuestionCard from '@/components/Quiz/QuestionCard';
import { useToast } from '@/hooks/use-toast';
import { RealtimeChannel } from '@supabase/supabase-js';

type QuestionType = {
  id: string;
  question_text: string;
  options: string[];
  correct_option_index: number;
};

const Question: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Get roomId from location state
  const roomId = location.state?.roomId;
  
  // States
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QuestionType[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(30); // 30 second countdown
  const [players, setPlayers] = useState<any[]>([]); // For player list/scores
  const [currentPlayerId, setCurrentPlayerId] = useState<string | null>(null);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  
  // Load current player ID from localStorage
  useEffect(() => {
    if (roomId) {
      const playerId = localStorage.getItem(`ggqt-playerId-${roomId}`);
      console.log(`[Question] Current player ID for room ${roomId}:`, playerId);
      setCurrentPlayerId(playerId);
    }
  }, [roomId]);

  // Fetch questions and room data
  const fetchQuestionData = useCallback(async () => {
    if (!roomId) {
      console.error("[Question] No roomId provided in location state");
      setError("Game session data missing. Please return to the home page.");
      setIsLoading(false);
      return;
    }

    try {
      console.log(`[Question] Fetching question data for room ${roomId}`);
      setIsLoading(true);
      
      // 1. Get room details to verify state and current question index
      const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .select('game_state, question_index, code')
        .eq('id', roomId)
        .single();
        
      if (roomError) {
        console.error("[Question] Error fetching room data:", roomError);
        setError("Could not load game data");
        setIsLoading(false);
        return;
      }
      
      console.log(`[Question] Room data:`, roomData);
      
      // Verify room is in question_active state
      if (roomData.game_state !== 'question_active') {
        console.warn(`[Question] Room is not in question_active state: ${roomData.game_state}`);
        toast({ title: "Session Error", description: "Game is not active. Returning to waiting room." });
        navigate(`/room/${roomData.code}`);
        return;
      }
      
      // Set current question index from room data
      setCurrentQuestionIndex(roomData.question_index || 0);
      
      // 2. Fetch questions for this room
      const { data: questionData, error: questionError } = await supabase
        .from('questions')
        .select('id, question_text, options, correct_option_index')
        .eq('room_id', roomId)
        .order('question_number', { ascending: true });
        
      if (questionError) {
        console.error("[Question] Error fetching questions:", questionError);
        setError("Could not load questions");
        setIsLoading(false);
        return;
      }
      
      if (!questionData || questionData.length === 0) {
        console.error("[Question] No questions found for this room");
        setError("No questions found for this game");
        setIsLoading(false);
        return;
      }
      
      console.log(`[Question] Loaded ${questionData.length} questions`);
      setQuestions(questionData as QuestionType[]);
      
      // 3. Fetch players for score display
      const { data: playerData, error: playerError } = await supabase
        .from('players')
        .select('id, name, score, is_host')
        .eq('room_id', roomId);
        
      if (playerError) {
        console.error("[Question] Error fetching players:", playerError);
      } else {
        console.log(`[Question] Loaded ${playerData?.length || 0} players`);
        setPlayers(playerData || []);
      }
      
    } catch (error) {
      console.error("[Question] Unexpected error:", error);
      setError("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  }, [roomId, navigate, toast]);
  
  // Initial data load
  useEffect(() => {
    fetchQuestionData();
  }, [fetchQuestionData]);
  
  // Set up realtime subscription for room updates
  useEffect(() => {
    if (!roomId) return;
    
    console.log(`[Question Realtime] Setting up subscription for room updates for room ${roomId}`);
    
    const channel: RealtimeChannel = supabase.channel(`question-updates-${roomId}`, {
      config: { broadcast: { self: true } }
    });
    
    channel
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'rooms',
        filter: `id=eq.${roomId}`
      }, (payload) => {
        console.log('[Question Realtime] Room update received:', payload);
        
        if (payload.new && typeof payload.new.game_state === 'string') {
          // Handle game state changes
          const newGameState = payload.new.game_state;
          const newQuestionIndex = payload.new.question_index;
          
          console.log(`[Question Realtime] Game state: ${newGameState}, Question index: ${newQuestionIndex}`);
          
          if (newGameState === 'question_active' && typeof newQuestionIndex === 'number') {
            // If it's a new question, reset state
            if (newQuestionIndex !== currentQuestionIndex) {
              console.log(`[Question Realtime] Updating to question ${newQuestionIndex}`);
              setCurrentQuestionIndex(newQuestionIndex);
              setTimeRemaining(30); // Reset timer
              setHasAnswered(false);
              setSelectedAnswer(null);
            }
          } else if (newGameState === 'finished') {
            toast({ title: "Game Over", description: "The game has ended" });
            navigate('/');
          }
        }
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'players',
        filter: `room_id=eq.${roomId}`
      }, (payload) => {
        console.log('[Question Realtime] Player update received:', payload);
        
        // Update player scores, etc.
        if (payload.eventType === 'UPDATE') {
          setPlayers(prev => prev.map(p => 
            p.id === payload.new.id ? { ...p, ...payload.new } : p
          ));
        }
      })
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log(`[Question Realtime] Successfully subscribed to room ${roomId} updates`);
        } else {
          console.error(`[Question Realtime] Subscription error:`, status, err);
        }
      });
      
    // Countdown timer
    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        // When timer reaches 0, handle timeout
        if (prev <= 1 && !hasAnswered) {
          console.log("[Question] Time's up! No answer selected.");
          
          // Auto-submit timeout answer
          if (!hasAnswered) {
            handleAnswer(-1); // -1 indicates timeout/no answer
          }
          
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    // Cleanup
    return () => {
      console.log(`[Question Realtime] Cleaning up subscriptions and timer`);
      clearInterval(timer);
      supabase.removeChannel(channel).then(success => {
        console.log(`[Question Realtime] Channel cleanup ${success ? 'successful' : 'failed'}`);
      });
    };
  }, [roomId, currentQuestionIndex, hasAnswered, navigate, toast]);
  
  // Handle answer selection
  const handleAnswer = async (answerIndex: number) => {
    if (hasAnswered || !currentPlayerId || !roomId) return;
    
    try {
      setHasAnswered(true);
      setSelectedAnswer(answerIndex);
      
      const currentQuestion = questions[currentQuestionIndex];
      if (!currentQuestion) {
        console.error("[Question] Current question not found");
        return;
      }
      
      const isCorrect = answerIndex === currentQuestion.correct_option_index;
      const timeTaken = 30 - timeRemaining; // Calculate time taken to answer
      
      console.log(`[Question] Answer submitted: option ${answerIndex}, correct: ${isCorrect}, time: ${timeTaken}s`);
      
      // Record answer in database
      const { error: answerError } = await supabase
        .from('answers')
        .insert({
          player_id: currentPlayerId,
          question_id: currentQuestion.id,
          selected_option_index: answerIndex,
          time_taken_ms: timeTaken * 1000, // Convert to milliseconds
          is_correct: isCorrect
        });
        
      if (answerError) {
        console.error("[Question] Error recording answer:", answerError);
        toast({ 
          title: "Error", 
          description: "Could not submit your answer",
          variant: "destructive"
        });
      } else {
        toast({
          title: isCorrect ? "Correct!" : "Incorrect",
          description: isCorrect 
            ? `Good job! You answered in ${timeTaken} seconds.`
            : "Better luck on the next question!",
          variant: isCorrect ? "default" : "destructive"
        });
        
        // If player is host, wait 5 seconds and advance to next question
        const isHost = players.find(p => p.id === currentPlayerId)?.is_host;
        if (isHost) {
          setTimeout(() => {
            moveToNextQuestion();
          }, 5000);
        }
      }
    } catch (error) {
      console.error("[Question] Error in handleAnswer:", error);
    }
  };
  
  // Function to move to next question (host only)
  const moveToNextQuestion = async () => {
    if (!roomId) return;
    
    try {
      const nextIndex = currentQuestionIndex + 1;
      
      // Check if that was the last question
      if (nextIndex >= questions.length) {
        console.log("[Question] That was the last question. Ending game.");
        
        // Update room to finished state
        await supabase
          .from('rooms')
          .update({ game_state: 'finished' })
          .eq('id', roomId);
          
        return;
      }
      
      console.log(`[Question] Moving to next question: ${nextIndex}`);
      
      // Update room with next question index
      await supabase
        .from('rooms')
        .update({ 
          question_index: nextIndex 
        })
        .eq('id', roomId);
        
    } catch (error) {
      console.error("[Question] Error moving to next question:", error);
    }
  };
  
  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-center">
          <div className="text-xl font-medium">Loading question...</div>
        </div>
      </div>
    );
  }
  
  // Error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-xl font-medium text-destructive">{error}</div>
          <button 
            onClick={() => navigate('/')}
            className="mt-4 px-4 py-2 bg-primary text-white rounded hover:bg-primary/90"
          >
            Return Home
          </button>
        </div>
      </div>
    );
  }
  
  // Get current question
  const currentQuestion = questions[currentQuestionIndex];
  
  // No questions available
  if (!currentQuestion) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-xl font-medium text-destructive">Question not found</div>
          <button 
            onClick={() => navigate('/')}
            className="mt-4 px-4 py-2 bg-primary text-white rounded hover:bg-primary/90"
          >
            Return Home
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-4 bg-gradient-to-b from-purple-50 to-white dark:from-gray-900 dark:to-gray-800">
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
    </div>
  );
};

export default Question;

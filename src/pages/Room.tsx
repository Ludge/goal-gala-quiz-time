
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client'; // Updated import path
import WaitingRoom from '@/components/Quiz/WaitingRoom';
import QuestionCard from '@/components/Quiz/QuestionCard';
import LeaderboardCard from '@/components/Quiz/LeaderboardCard';
import EmojiReactionPanel from '@/components/Quiz/EmojiReactionPanel';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Home, ChevronRight } from 'lucide-react';
import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

// Define Player type based on Supabase table
type Player = {
  id: string; // uuid
  room_id: string; // uuid
  user_id: string | null; // uuid, nullable for anonymous
  name: string;
  is_host: boolean;
  score: number;
  joined_at: string; // timestampz
  // Make these required for LeaderboardCard compatibility - ensure default values or calculations later
  averageTime: number; 
  correctAnswers: number;
  totalAnswers: number; 
};

// Temporary mock data - will be replaced with Supabase data
const mockQuestions = [
  {
    id: '1',
    text: 'Which team won the UEFA Champions League in 2005 after being 3-0 down at halftime?',
    options: ['Liverpool', 'AC Milan', 'Barcelona', 'Bayern Munich'],
    correctOptionIndex: 0,
  },
  {
    id: '2',
    text: 'Which player scored the famous "Hand of God" goal?',
    options: ['Pelé', 'Diego Maradona', 'Zinedine Zidane', 'Ronaldo'],
    correctOptionIndex: 1,
  },
  {
    id: '3',
    text: 'Which country won the 2010 FIFA World Cup?',
    options: ['Brazil', 'Germany', 'Spain', 'Netherlands'],
    correctOptionIndex: 2,
  },
];

// Game states
type GameState = 'waiting' | 'playing' | 'question_active' | 'review' | 'finished';

// Type for the payload specific to the 'players' table
type PlayerPayload = RealtimePostgresChangesPayload<Player>; 
// Type for the payload specific to the 'rooms' table
// Be more specific about expected fields in the payload
type RoomPayload = RealtimePostgresChangesPayload<{ 
  id: string; 
  code: string; 
  created_at: string; 
  game_state: GameState;
  question_index: number;
}>;

const Room: React.FC = () => {
  const { roomId: roomCode } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // States for game management
  const [gameState, setGameState] = useState<GameState>('waiting');
  const [players, setPlayers] = useState<Player[]>([]);
  const [roomDetails, setRoomDetails] = useState<{ id: string; code: string } | null>(null);
  const [questions, setQuestions] = useState(mockQuestions);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [showCorrectAnswer, setShowCorrectAnswer] = useState(false);
  const [userAnswer, setUserAnswer] = useState<number | null>(null);
  const [timeElapsed, setTimeElapsed] = useState<number>(0);
  const [reactionCounts, setReactionCounts] = useState<Record<string, number>>({
    clap: 0,
    laugh: 0,
    sad: 0,
    wow: 0,
    fire: 0,
    party: 0,
  });
  const channelRef = useRef<RealtimeChannel | null>(null);
  
  // Get current player ID from localStorage
  const [currentPlayerId, setCurrentPlayerId] = useState<string | null>(() => {
    // Read immediately on component init
    if (!roomDetails?.id) return null; // Need roomDetails to be set first
    const storedPlayerId = localStorage.getItem(`ggqt-playerId-${roomDetails.id}`);
    console.log(`Room init: Read stored player ID for room ${roomDetails.id}:`, storedPlayerId);
    return storedPlayerId;
  });
  const isHost = players.find(p => p.id === currentPlayerId)?.is_host ?? false;
  
  // Fetch initial room details and players
  const fetchInitialData = useCallback(async () => {
    if (!roomCode) return;
    console.log(`Fetching initial data for room code: ${roomCode}`);
    try {
      // 1. Get room ID from code
      const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .select('id, code')
        .eq('code', roomCode)
        .single();

      if (roomError || !roomData) {
        console.error("Error fetching room or room not found:", roomError);
        toast({ title: "Error", description: `Room ${roomCode} not found.`, variant: "destructive" });
        navigate('/');
        return;
      }
      setRoomDetails(roomData);
      console.log(`Room ID found: ${roomData.id}`);

      // Now that roomDetails is set, try reading player ID from localStorage again
      const storedPlayerId = localStorage.getItem(`ggqt-playerId-${roomData.id}`);
      console.log(`fetchInitialData: Read stored player ID for room ${roomData.id}:`, storedPlayerId);
      setCurrentPlayerId(storedPlayerId);

      // 2. Fetch current players in the room
      const { data: playersData, error: playersError } = await supabase
        .from('players')
        .select('*') // Select all columns for now
        .eq('room_id', roomData.id)
        .order('joined_at', { ascending: true });

      if (playersError) {
        console.error("Error fetching players:", playersError);
        toast({ title: "Error", description: "Could not fetch player list.", variant: "destructive" });
      } else {
        console.log("Initial players fetched:", playersData);
        setPlayers(playersData || []);
      }
    } catch (error) {
      console.error("Unexpected error fetching initial data:", error);
      toast({ title: "Error", description: "An unexpected error occurred.", variant: "destructive" });
      navigate('/');
    }
  }, [roomCode, navigate, toast]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  // Define Player Payload Handler with specific type
  const handlePlayerPayload = (payload: PlayerPayload) => {
    console.log('[Realtime Event] Player change received!', payload);
    
    // Helper function: Input can be partial player data or null/undefined
    const ensurePlayerDefaults = (playerData: Partial<Player> | null | undefined): Player => {
        const data = playerData || {}; 
        return {
            id: data.id ?? '',
            room_id: data.room_id ?? '',
            user_id: data.user_id ?? null,
            name: data.name ?? 'Unknown',
            is_host: data.is_host ?? false,
            score: data.score ?? 0,
            joined_at: data.joined_at ?? new Date().toISOString(),
            averageTime: data.averageTime ?? 0, 
            correctAnswers: data.correctAnswers ?? 0,
            totalAnswers: data.totalAnswers ?? 0,
        } as Player; 
    }

    switch (payload.eventType) {
        case 'INSERT': {
          // payload.new should contain the inserted record
          const newPlayer = ensurePlayerDefaults(payload.new as Partial<Player>); 
          setPlayers(currentPlayers => {
              if (currentPlayers.some(p => p.id === newPlayer.id)) {
                  return currentPlayers;
              }
              return [...currentPlayers, newPlayer];
          });
          toast({ title: "Player Joined", description: `${newPlayer.name} has entered the room.` });
          break;
        }
        case 'UPDATE': {
          // payload.new should contain the updated fields
          const updatedPlayerData = payload.new as Partial<Player>; 
          const oldPlayerId = payload.old?.id;
          if(oldPlayerId) {
              setPlayers(currentPlayers =>
                currentPlayers.map(p => p.id === oldPlayerId ? { ...p, ...updatedPlayerData } : p) // Merge updated fields
              );
          } else {
             console.warn("[Realtime Event] Received UPDATE event without old ID:", payload);
          }
          break;
        }
        case 'DELETE': {
          // payload.old should contain the deleted record's ID (and potentially other fields)
          const oldPlayerId = (payload.old as Partial<Player>)?.id; 
          if(oldPlayerId) {
              const deletedPlayer = players.find(p => p.id === oldPlayerId);
              setPlayers(currentPlayers => currentPlayers.filter(p => p.id !== oldPlayerId));
              toast({ title: "Player Left", description: `${deletedPlayer?.name || 'A player'} has left the room.`, variant: "destructive" });
          } else {
              console.warn("[Realtime Event] Received DELETE event without old ID:", payload);
          }
          break;
        }
    }
  };

  // Function to fetch questions from the database
  const fetchQuestionsFromDatabase = async (roomId: string) => {
    try {
      console.log(`Fetching questions for room ${roomId} from database...`);
      const { data: questionsData, error } = await supabase
        .from('questions')
        .select('*')
        .eq('room_id', roomId)
        .order('question_number', { ascending: true });
        
      if (error) {
        console.error("Error fetching questions:", error);
        toast({ title: "Error", description: "Could not load questions", variant: "destructive" });
        return;
      }
      
      if (!questionsData || questionsData.length === 0) {
        console.warn("No questions found for this room");
        toast({ title: "Warning", description: "No questions found", variant: "destructive" });
        return;
      }
      
      console.log(`Loaded ${questionsData.length} questions from database`);
      
      // Convert from database format to our UI format
      const formattedQuestions = questionsData.map(q => ({
        id: q.id,
        text: q.question_text,
        options: q.options,
        correctOptionIndex: q.correct_option_index
      }));
      
      setQuestions(formattedQuestions);
    } catch (err) {
      console.error("Unexpected error loading questions:", err);
      toast({ title: "Error", description: "Failed to load questions", variant: "destructive" });
    }
  };

  // --- NEW: Rebuilt Realtime Subscription Logic --- 
  useEffect(() => {
    // Exit early if roomDetails.id is not yet available
    if (!roomDetails?.id) {
      console.log('[Realtime V2 Setup] Waiting for roomDetails.id...');
      return;
    }

    const currentRoomId = roomDetails.id;
    console.log(`[Realtime V2 Setup] Initializing for room ID: ${currentRoomId}`);

    // Create a unique channel name for this room
    const channelName = `room-${currentRoomId}`;
    console.log(`[Realtime V2 Setup] Creating channel: ${channelName}`);
    const channel = supabase.channel(channelName, {
      config: {
        broadcast: { self: true }, // Ensure we receive our own broadcasts if needed later
      },
    });

    // --- Handler for Room Updates --- 
    const handleRoomUpdate = (payload: RoomPayload) => {
      console.log('[Realtime V2 Event] Room update received:', payload);

      if (payload.eventType === 'UPDATE' && payload.new) {
        const newGameState = payload.new.game_state;
        const newQuestionIndex = payload.new.question_index;

        console.log(`[Realtime V2 Event] New room state: ${newGameState}, Index: ${newQuestionIndex}`);

        // --- Core Logic: Transition to Question View --- 
        if (newGameState === 'question_active') {
          console.log(`[Realtime V2 ACTION] Game state is 'question_active'. Navigating to /question for room ${currentRoomId}...`);
          toast({ title: "Question Time!", description: "Let's go!" });
          // Use navigate with replace to prevent back button returning to waiting room easily
          navigate(`/question`, { replace: true, state: { roomId: currentRoomId } });
        } else if (newGameState === 'playing' && gameState !== 'playing') {
          // Update local state for the "Get Ready..." screen
          console.log(`[Realtime V2 State] Updating local state to 'playing'`);
          setGameState('playing');
          toast({ title: "Game Starting Soon!", description: "Get ready..." });
        } else if (newGameState === 'finished' && gameState !== 'finished') {
          // Update local state for the final results screen
          console.log(`[Realtime V2 State] Updating local state to 'finished'`);
          setGameState('finished');
          toast({ title: "Game Over!", description: "Let's see the scores." });
        } else if (newGameState === 'waiting' && gameState !== 'waiting') {
          // Handle potential reset to waiting state
          console.log(`[Realtime V2 State] Updating local state to 'waiting'`);
          setGameState('waiting');
        } else {
          console.log('[Realtime V2 Event] No relevant game state change detected or state already matches.');
        }

        // Keep question index synchronized if it changes
        if (typeof newQuestionIndex === 'number' && newQuestionIndex !== currentQuestionIndex) {
          console.log(`[Realtime V2 State] Updating question index to ${newQuestionIndex}`);
          setCurrentQuestionIndex(newQuestionIndex);
        }

      } else {
        console.log('[Realtime V2 Event] Received non-UPDATE event or missing payload.new data:', payload);
      }
    };

    // --- Subscribe to Changes --- 
    channel
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'rooms',
          filter: `id=eq.${currentRoomId}`,
        },
        handleRoomUpdate as (payload: RealtimePostgresChangesPayload<any>) => void // Cast for type compatibility
      )
      .on(
        'postgres_changes',
        {
          event: '*', // Listen for INSERT, UPDATE, DELETE on players
          schema: 'public',
          table: 'players',
          filter: `room_id=eq.${currentRoomId}`,
        },
        (payload) => {
          console.log('[Realtime V2 Event] Player change received:', payload);
          handlePlayerPayload(payload as PlayerPayload);
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log(`[Realtime V2 Status] Successfully SUBSCRIBED to channel ${channel.topic}`);
          // Optionally fetch current state upon successful subscription if needed
        } else {
          console.error(`[Realtime V2 Status] Subscription FAILED/ERROR on channel ${channel.topic}. Status: ${status}`, err || '');
          toast({ title: "Realtime Issue", description: `Subscription failed: ${status}`, variant: "destructive" });
          // Consider attempting resubscription or showing a persistent error
        }
      });

    console.log(`[Realtime V2 Setup] Subscription initiated for channel ${channel.topic}`);
    channelRef.current = channel; // Store the channel reference

    // --- Cleanup Function --- 
    return () => {
      console.log(`[Realtime V2 Cleanup] Running cleanup for channel ${channel.topic}...`);
      const chan = channelRef.current;
      if (chan) {
        console.log(`[Realtime V2 Cleanup] Unsubscribing and removing channel: ${chan.topic}`);
        supabase.removeChannel(chan)
          .then(status => console.log(`[Realtime V2 Cleanup] Remove channel status: ${status}`)) // Log removal status
          .catch(error => console.error(`[Realtime V2 Cleanup] Error removing channel: ${error}`));
        channelRef.current = null;
      } else {
        console.warn(`[Realtime V2 Cleanup] No channel reference found during cleanup for room ${currentRoomId}.`);
      }
    };

  }, [roomDetails?.id, navigate, toast]); // Dependencies: Rerun ONLY if room ID, navigate, or toast changes

  // Handle starting the game
  const handleStartGame = async () => {
    if (!roomDetails?.id || !isHost) {
      console.error("handleStartGame: Conditions not met", { roomId: roomDetails?.id, isHost });
      return;
    }

    try {
      // 1. Update room game_state in Supabase to 'playing' (preparing state)
      console.log(`Attempting to update room ${roomDetails.id} game_state to 'playing'`);
      const { error: updateError } = await supabase
          .from('rooms')
          .update({ game_state: 'playing' })
          .eq('id', roomDetails.id);

      if (updateError) {
          console.error("Error updating room game_state:", updateError);
          toast({ title: "Error", description: `Failed to start game: ${updateError.message}`, variant: "destructive" });
          return;
      }

      // 2. Fetch questions from Gemini AI via Supabase Edge Function 'geminiQuiz'
      console.log("Fetching questions from Gemini AI...");
      const { data: questionsData, error: questionsError } = await supabase.functions.invoke('geminiQuiz', { body: { count: 10 } });
      if (questionsError || !questionsData) {
        toast({ title: "Error", description: `Failed to fetch questions: ${questionsError?.message || 'Unknown error'}`, variant: "destructive" });
        return;
      }
      
      console.log("Raw questions from Gemini:", questionsData);
      
      // Format the questions to match our app's expected structure
      const formattedQuestions = questionsData.questions.map(q => ({
        id: q.id?.toString() || crypto.randomUUID(),
        text: q.question,
        options: q.options,
        correctOptionIndex: q.correctAnswer !== undefined ? q.correctAnswer : q.correct_option_index
      }));
      
      // Store fetched questions locally
      setQuestions(formattedQuestions);
      console.log("Formatted questions for UI:", formattedQuestions);
      
      // 3. Store questions in the database
      console.log("Storing questions in database...");
      
      // Verify we have a valid session
      const { data: { session } } = await supabase.auth.getSession();
      console.log("Current session:", session);
      
      if (!session) {
        console.log("No active session, creating anonymous session");
        // Create an anonymous session if needed
        await supabase.auth.signInAnonymously();
        console.log("Anonymous session created");
      }
      
      const questionsToInsert = formattedQuestions.map((q, index) => ({
        room_id: roomDetails.id,
        question_number: index,
        question_text: q.text,
        options: q.options,
        correct_option_index: q.correctOptionIndex
      }));

      console.log("Inserting questions:", questionsToInsert);
      const { data: insertedData, error: insertError } = await supabase
        .from('questions')
        .upsert(questionsToInsert)
        .select();

      if (insertError) {
        console.error("Error storing questions:", insertError);
        toast({ title: "Error", description: `Failed to store questions: ${insertError.message}`, variant: "destructive" });
        return;
      }
      
      console.log("Questions successfully stored in database:", insertedData);

      // 4. Update the room to start the first question (active state)
      console.log(`Questions ready. Transitioning to 'question_active' state with index 0`);
      const { error: activeError } = await supabase
          .from('rooms')
          .update({ 
              game_state: 'question_active',
              question_index: 0
          })
          .eq('id', roomDetails.id);

      if (activeError) {
          console.error("Error updating to question_active state:", activeError);
          toast({ title: "Error", description: `Failed to transition to question: ${activeError.message}`, variant: "destructive" });
          return;
      }

      console.log(`Room ${roomDetails.id} successfully updated to 'question_active'.`);
      toast({ title: "Game starting!", description: "First question is ready!" });
    } catch (err) {
      console.error("Unexpected error in handleStartGame:", err);
      toast({ title: "Error", description: "An unexpected error occurred starting the game", variant: "destructive" });
    }
  };
  
  // Handle player answers
  const handleAnswer = (optionIndex: number, answeredTimeElapsed: number) => {
    setUserAnswer(optionIndex);
    setTimeElapsed(answeredTimeElapsed);
    setShowCorrectAnswer(true);
    
    // Calculate score based on correctness and speed
    // We'll implement this with Supabase later
    
    // Wait before showing the next question review
    setTimeout(() => {
      // Show updated leaderboard here
    }, 1500);
  };
  
  // Handle moving to the next question
  const handleNextQuestion = async () => {
    if (!roomDetails?.id) return;
    
    if (currentQuestionIndex < questions.length - 1) {
      const nextIndex = currentQuestionIndex + 1;
      
      // Update on server first if host
      if (isHost) {
        try {
          console.log(`Updating to next question index: ${nextIndex}`);
          const { error } = await supabase
            .from('rooms')
            .update({ 
              game_state: 'question_active',
              question_index: nextIndex 
            })
            .eq('id', roomDetails.id);
            
          if (error) {
            console.error("Error updating question index:", error);
            toast({ title: "Error", description: "Failed to move to next question", variant: "destructive" });
          }
        } catch (err) {
          console.error("Unexpected error moving to next question:", err);
        }
      }
      
      // Local state updates will be handled by the realtime subscription
      // But we'll update locally too in case of network issues
      setShowCorrectAnswer(false);
      setUserAnswer(null);
    } else {
      // Update the game state to finished if host
      if (isHost) {
        try {
          console.log(`Game complete. Updating to finished state.`);
          const { error } = await supabase
            .from('rooms')
            .update({ game_state: 'finished' })
            .eq('id', roomDetails.id);
            
          if (error) {
            console.error("Error updating game state to finished:", error);
            toast({ title: "Error", description: "Failed to end game", variant: "destructive" });
          }
        } catch (err) {
          console.error("Unexpected error ending game:", err);
        }
      }
      
      // Local state updates will be handled by the realtime subscription
    }
  };
  
  // Handle sending emoji reactions
  const handleSendReaction = (emojiId: string) => {
    // Increment local count for immediate feedback
    setReactionCounts(prev => ({
      ...prev,
      [emojiId]: prev[emojiId] + 1
    }));
    
    // We'll implement broadcasting to other players via Supabase later
    toast({
      title: "Reaction sent!",
      description: "Your reaction has been shared with the room",
    });
    
    // Simulate receiving reactions from others
    setTimeout(() => {
      const randomEmojiId = Object.keys(reactionCounts)[
        Math.floor(Math.random() * Object.keys(reactionCounts).length)
      ];
      setReactionCounts(prev => ({
        ...prev,
        [randomEmojiId]: prev[randomEmojiId] + 1
      }));
    }, 2000);
  };
  
  // Handle game restart
  const handleRestartGame = () => {
    setGameState('waiting');
    setCurrentQuestionIndex(0);
    setShowCorrectAnswer(false);
    setUserAnswer(null);
    
    // Reset reactions
    setReactionCounts({
      clap: 0,
      laugh: 0,
      sad: 0,
      wow: 0,
      fire: 0,
      party: 0,
    });
  };
  
  // Return to home
  const handleReturnHome = () => {
    navigate('/');
  };
  
  // Render different content based on game state
  const renderGameContent = () => {
    console.log(`[Rendering] Current game state: ${gameState}, questions: ${questions.length}, currentQuestionIndex: ${currentQuestionIndex}`);
    
    switch (gameState) {
      case 'waiting':
        return (
          <WaitingRoom
            roomCode={roomCode || 'ERROR'}
            players={players}
            isHost={isHost}
            onStartGame={handleStartGame}
          />
        );
        
      case 'playing':
        console.log(`[Rendering] Showing 'Get ready...' screen`);
        return (
          <div className="w-full max-w-2xl mx-auto text-center p-8">
            <h2 className="text-2xl font-bold mb-4">Get ready...</h2>
            <p className="text-muted-foreground mb-6">Loading questions</p>
            <div className="animate-pulse flex space-x-4 justify-center">
              <div className="rounded-full bg-primary/70 h-4 w-4"></div>
              <div className="rounded-full bg-primary/70 h-4 w-4"></div>
              <div className="rounded-full bg-primary/70 h-4 w-4"></div>
            </div>
          </div>
        );
        
      case 'finished':
        console.log(`[Rendering] Showing finished screen`);
        return (
          <div className="w-full max-w-2xl mx-auto">
            <div className="mb-6 text-center">
              <h2 className="text-2xl font-bold mb-2">Game Completed!</h2>
              <p className="text-muted-foreground">
                Let's see how everyone performed...
              </p>
            </div>
            
            <LeaderboardCard players={players} isFinal={true} />
            
            <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
              {isHost && (
                <Button 
                  className="sm:flex-1" 
                  variant="outline" 
                  onClick={handleRestartGame}
                >
                  Play Again
                </Button>
              )}
              
              <Button 
                className="sm:flex-1" 
                onClick={handleReturnHome}
              >
                <Home className="mr-2 h-4 w-4" />
                Return Home
              </Button>
            </div>
          </div>
        );
        
      default:
        return <div>Something went wrong</div>;
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-4 bg-gradient-to-b from-purple-50 to-white dark:from-gray-900 dark:to-gray-800">
      {renderGameContent()}
      
      {gameState !== 'waiting' && (
        <EmojiReactionPanel
          onSendReaction={handleSendReaction}
          reactionCounts={reactionCounts}
        />
      )}
    </div>
  );
};

export default Room;

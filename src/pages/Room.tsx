
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import WaitingRoom from '@/components/Quiz/WaitingRoom';
import { useToast } from '@/hooks/use-toast';
import { RealtimeChannel } from '@supabase/supabase-js';

// Define Player type based on database schema
type Player = {
  id: string;
  room_id: string;
  user_id: string | null;
  name: string;
  is_host: boolean;
  score: number;
  joined_at: string;
  // Derived properties for UI components
  averageTime: number;
  correctAnswers: number;
  totalAnswers: number;
};

// Room component - focused solely on the waiting room stage
const Room: React.FC = () => {
  const { roomId: roomCode } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Core state
  const [players, setPlayers] = useState<Player[]>([]);
  const [roomDetails, setRoomDetails] = useState<{ id: string; code: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Determine current player
  const [currentPlayerId, setCurrentPlayerId] = useState<string | null>(null);
  const isHost = players.find(p => p.id === currentPlayerId)?.is_host ?? false;
  
  // Fetch initial room details and players
  const fetchInitialData = useCallback(async () => {
    if (!roomCode) return;
    console.log(`Fetching initial data for room code: ${roomCode}`);
    try {
      setIsLoading(true);
      // 1. Get room ID from code
      const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .select('id, code, game_state')
        .eq('code', roomCode)
        .single();

      if (roomError || !roomData) {
        console.error("Error fetching room or room not found:", roomError);
        toast({ title: "Error", description: `Room ${roomCode} not found.`, variant: "destructive" });
        navigate('/');
        return;
      }

      // If room is already in question_active state, redirect immediately
      if (roomData.game_state === 'question_active') {
        console.log(`Room ${roomCode} already in question_active state. Redirecting to question view...`);
        navigate(`/question`, { state: { roomId: roomData.id } });
        return;
      }
      
      setRoomDetails(roomData);
      console.log(`Room ID found: ${roomData.id} (State: ${roomData.game_state})`);

      // Now that roomDetails is set, try reading player ID from localStorage
      const storedPlayerId = localStorage.getItem(`ggqt-playerId-${roomData.id}`);
      console.log(`fetchInitialData: Read stored player ID for room ${roomData.id}:`, storedPlayerId);
      setCurrentPlayerId(storedPlayerId);

      // 2. Fetch current players in the room
      const { data: playersData, error: playersError } = await supabase
        .from('players')
        .select('*')
        .eq('room_id', roomData.id)
        .order('joined_at', { ascending: true });

      if (playersError) {
        console.error("Error fetching players:", playersError);
        toast({ title: "Error", description: "Could not fetch player list.", variant: "destructive" });
        setError("Could not fetch player list");
      } else {
        console.log("Initial players fetched:", playersData);
        // Transform playersData to include the required derived properties
        const enhancedPlayers = playersData?.map(player => ({
          ...player,
          averageTime: 0,
          correctAnswers: 0,
          totalAnswers: 0
        })) || [];
        setPlayers(enhancedPlayers);
      }
    } catch (error) {
      console.error("Unexpected error fetching initial data:", error);
      toast({ title: "Error", description: "An unexpected error occurred.", variant: "destructive" });
      navigate('/');
    } finally {
      setIsLoading(false);
    }
  }, [roomCode, navigate, toast]);

  // Initial data load
  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  // Handle player updates via realtime
  const handlePlayerChange = useCallback((payload: any) => {
    console.log('[Realtime] Player change received:', payload);
    
    if (payload.eventType === 'INSERT') {
      const newPlayer = {
        ...payload.new,
        averageTime: 0,
        correctAnswers: 0,
        totalAnswers: 0
      };
      setPlayers(current => {
        if (current.some(p => p.id === newPlayer.id)) return current;
        return [...current, newPlayer];
      });
      toast({ title: "Player Joined", description: `${newPlayer.name} has entered the room.` });
    } 
    else if (payload.eventType === 'UPDATE') {
      setPlayers(current => 
        current.map(p => p.id === payload.new.id ? { 
          ...p, 
          ...payload.new,
          // Preserve derived properties
          averageTime: p.averageTime,
          correctAnswers: p.correctAnswers,
          totalAnswers: p.totalAnswers
        } : p)
      );
    }
    else if (payload.eventType === 'DELETE') {
      const deletedPlayerId = payload.old?.id;
      if (deletedPlayerId) {
        const playerName = players.find(p => p.id === deletedPlayerId)?.name || 'A player';
        setPlayers(current => current.filter(p => p.id !== deletedPlayerId));
        toast({ title: "Player Left", description: `${playerName} has left the room.`, variant: "destructive" });
      }
    }
  }, [players, toast]);

  // CORE FEATURE: Set up realtime subscription for room status changes
  useEffect(() => {
    if (!roomDetails?.id) {
      console.log('[Realtime] Waiting for roomDetails.id before setting up subscription...');
      return;
    }

    console.log(`[Realtime] Setting up subscription for room ID: ${roomDetails.id}`);
    
    // Create a dedicated channel for this room
    const channel: RealtimeChannel = supabase.channel(`room-updates-${roomDetails.id}`, {
      config: { broadcast: { self: true } }
    });

    // Listen for room updates - especially game_state changes
    channel
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public', 
        table: 'rooms',
        filter: `id=eq.${roomDetails.id}`
      }, (payload) => {
        console.log('[Realtime] Room update received:', payload);
        
        if (payload.new && typeof payload.new.game_state === 'string') {
          const newGameState = payload.new.game_state;
          
          console.log(`[Realtime] Room ${roomDetails.id} state changed to: ${newGameState}`);
          
          // CRITICAL PATH: Redirect to question view when game starts
          if (newGameState === 'question_active') {
            console.log(`[Realtime] Game starting! Navigating to question view`);
            toast({ title: "Game Starting!", description: "First question is ready!" });
            
            // Navigate with state containing the room ID
            navigate(`/question`, { 
              state: { roomId: roomDetails.id } 
            });
          }
        }
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'players',
        filter: `room_id=eq.${roomDetails.id}`
      }, handlePlayerChange)
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log(`[Realtime] Successfully subscribed to room updates for ${roomDetails.id}`);
        } else {
          console.error(`[Realtime] Subscription error:`, status, err);
          toast({ 
            title: "Connection Issue", 
            description: "Problem connecting to game updates. Please refresh.",
            variant: "destructive" 
          });
        }
      });

    // Cleanup function
    return () => {
      console.log(`[Realtime] Cleaning up subscription for room ${roomDetails.id}`);
      supabase.removeChannel(channel).then(success => {
        console.log(`[Realtime] Channel cleanup ${success ? 'successful' : 'failed'}`);
      });
    };
  }, [roomDetails?.id, navigate, toast, handlePlayerChange]);

  // Handle starting the game
  const handleStartGame = async () => {
    if (!roomDetails?.id || !isHost) {
      console.error("Cannot start game: Invalid room or not host", { roomId: roomDetails?.id, isHost });
      return;
    }

    try {
      // 1. Update room to 'playing' (prep state)
      console.log(`Updating room ${roomDetails.id} to 'playing' state`);
      const { error: updateError } = await supabase
        .from('rooms')
        .update({ game_state: 'playing' })
        .eq('id', roomDetails.id);

      if (updateError) {
        console.error("Error updating room game_state:", updateError);
        toast({ title: "Error", description: `Failed to start game`, variant: "destructive" });
        return;
      }

      toast({ title: "Getting Ready", description: "Preparing questions..." });

      // 2. Fetch questions from Gemini API
      console.log("Fetching questions from Gemini API...");
      const { data: questionsData, error: questionsError } = await supabase.functions
        .invoke('geminiQuiz', { body: { count: 10 } });

      if (questionsError || !questionsData) {
        console.error("Error fetching questions:", questionsError);
        toast({ title: "Error", description: "Failed to fetch questions", variant: "destructive" });
        return;
      }
      
      console.log("Questions received from Gemini:", questionsData);
      
      // 3. First, delete any existing questions for this room to avoid conflicts
      console.log(`Clearing any existing questions for room ${roomDetails.id}...`);
      await supabase
        .from('questions')
        .delete()
        .eq('room_id', roomDetails.id);
      
      // 4. Insert new questions into database
      console.log("Storing questions in database...");
      const questionsToInsert = questionsData.questions.map((q: any, index: number) => ({
        room_id: roomDetails.id,
        question_number: index,
        question_text: q.question,
        options: q.options,
        correct_option_index: q.correctAnswer !== undefined ? q.correctAnswer : q.correct_option_index
      }));

      const { error: insertError } = await supabase
        .from('questions')
        .insert(questionsToInsert);

      if (insertError) {
        console.error("Error storing questions:", insertError);
        toast({ title: "Error", description: `Failed to store questions`, variant: "destructive" });
        return;
      }
      
      console.log("Questions successfully stored in database");

      // 5. Update room to 'question_active' to trigger the game start
      console.log(`Starting game: Updating room ${roomDetails.id} to question_active state`);
      const { error: activeError } = await supabase
        .from('rooms')
        .update({ 
          game_state: 'question_active',
          question_index: 0
        })
        .eq('id', roomDetails.id);

      if (activeError) {
        console.error("Error updating to question_active state:", activeError);
        toast({ title: "Error", description: `Failed to start game`, variant: "destructive" });
        return;
      }

      console.log("Game start successful!");
      // No navigation here - the realtime subscription will handle it
    } catch (err) {
      console.error("Unexpected error in handleStartGame:", err);
      toast({ title: "Error", description: "An unexpected error occurred", variant: "destructive" });
    }
  };

  // Render the waiting room
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-center">
          <div className="text-xl font-medium">Loading room...</div>
        </div>
      </div>
    );
  }

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

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-4 bg-gradient-to-b from-purple-50 to-white dark:from-gray-900 dark:to-gray-800">
      <WaitingRoom
        roomCode={roomCode || 'ERROR'}
        players={players}
        isHost={isHost}
        onStartGame={handleStartGame}
      />
    </div>
  );
};

export default Room;

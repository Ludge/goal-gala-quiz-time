import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import WaitingRoom from '@/components/Quiz/WaitingRoom';
import { useToast } from '@/hooks/use-toast';
import { RealtimeChannel } from '@supabase/supabase-js';
import { getPlayerCookie } from '@/lib/utils';

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

// Define the specific payload structure for room updates
interface RoomRow {
  id: string;
  code: string;
  game_state: string;
  question_index: number;
  created_at: string;
  // Add other relevant fields from the 'rooms' table
}

// Define the specific payload structure for player changes
// Use the existing Player type, but make derived properties optional in payload
interface PlayerRow extends Omit<Player, 'averageTime' | 'correctAnswers' | 'totalAnswers'> {
  averageTime?: number;
  correctAnswers?: number;
  totalAnswers?: number;
}

// Revert to simpler payload type for player changes
interface PlayerChangePayload {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new?: Player;
  old?: Player;
}

// Room component - focused solely on the waiting room stage
const Room: React.FC = () => {
  const { roomId: roomCode } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Core state
  const [players, setPlayers] = useState<Player[]>([]);
  const [roomDetails, setRoomDetails] = useState<{ id: string; code: string; game_state: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isStartingGame, setIsStartingGame] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Determine current player
  const [currentPlayerId, setCurrentPlayerId] = useState<string | null>(null);
  const isHost = players.find(p => p.id === currentPlayerId)?.is_host ?? false;
  
  // Use refs to track subscription state and prevent duplicate subscriptions
  const channelRef = useRef<RealtimeChannel | null>(null);
  const hasRedirectedRef = useRef<boolean>(false);

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
    // Check for player identity cookies first
    const { name: cookieName, userId: cookieUserId } = getPlayerCookie();
    if (cookieUserId) {
      setCurrentPlayerId(cookieUserId);
      // Optionally, you could set player name in state if needed
      // (currently not tracked in state, but could be added)
    }
    fetchInitialData();
  }, [fetchInitialData]);

  // Handle player updates via realtime - Simplified back
  const handlePlayerChange = useCallback((payload: PlayerChangePayload) => {
    console.log('[Realtime] Player change received:', payload);
    
    if (payload.eventType === 'INSERT' && payload.new) {
      const newPlayer = {
        ...payload.new,
        // Initialize derived properties
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
    else if (payload.eventType === 'UPDATE' && payload.new) {
      setPlayers(current => 
        current.map(p => p.id === payload.new?.id ? { 
          ...p, 
          ...payload.new,
          // Preserve existing derived properties - ensure payload.new doesn't overwrite with null/undefined if not present
          averageTime: payload.new.averageTime ?? p.averageTime,
          correctAnswers: payload.new.correctAnswers ?? p.correctAnswers,
          totalAnswers: payload.new.totalAnswers ?? p.totalAnswers
        } : p)
      );
    }
    else if (payload.eventType === 'DELETE' && payload.old) {
      const deletedPlayerId = payload.old.id;
      if (deletedPlayerId) {
        const playerName = players.find(p => p.id === deletedPlayerId)?.name || 'A player';
        setPlayers(current => current.filter(p => p.id !== deletedPlayerId));
        toast({ title: "Player Left", description: `${playerName} has left the room.`, variant: "destructive" });
      }
    }
  }, [players, toast]);

  // --- REALTIME SUBSCRIPTION LOGIC (Reverted Typing) ---
  useEffect(() => {
    if (!roomDetails?.id) return;
    if (channelRef.current) return;

    const channel = supabase.channel(`room-updates-${roomDetails.id}`);
    channelRef.current = channel;

    // Listener for Room Updates (game state changes)
    channel.on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'rooms',
        filter: `id=eq.${roomDetails.id}`,
      },
      (payload: any) => { // Revert to any
        console.log('[Realtime][DEBUG] Room update received:', payload);
        console.log('[Realtime][DEBUG] Current roomDetails.id:', roomDetails.id);
        if (payload?.new) {
          console.log('[Realtime][DEBUG] payload.new.game_state:', payload.new.game_state);
          console.log('[Realtime][DEBUG] hasRedirectedRef.current:', hasRedirectedRef.current);
        }
        if (
          payload?.new &&
          payload.new.game_state === 'question_active' &&
          !hasRedirectedRef.current
        ) {
          hasRedirectedRef.current = true;
          console.log('[Realtime][DEBUG] Game state is now question_active! Attempting navigation to /question');
          toast({
            title: 'Game Starting!',
            description: 'First question is ready!',
            variant: 'default',
          });
          setTimeout(() => {
            console.log('[Realtime][DEBUG] Navigating to /question with roomId:', roomDetails.id);
            navigate('/question', { state: { roomId: roomDetails.id } });
          }, 500);
        }
      }
    );

    // Listener for Player Changes (joins/leaves)
    channel.on(
      'postgres_changes',
      {
        event: '*', // Listen for INSERT, UPDATE, DELETE
        schema: 'public',
        table: 'players',
        filter: `room_id=eq.${roomDetails.id}`,
      },
       (payload: any) => { // Revert to any
         // Directly pass the payload, assuming handlePlayerChange can handle its structure
         handlePlayerChange(payload as PlayerChangePayload); 
       }
    );

    channel.subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        console.log(`[Realtime][DEBUG] Successfully subscribed to room updates for ${roomDetails.id}`);
      } else if (status === 'CLOSED') {
        console.error('[Realtime][DEBUG] Channel closed unexpectedly', err);
        channelRef.current = null;
      } else if (status === 'CHANNEL_ERROR') {
        console.error('[Realtime][DEBUG] Channel error', err);
        channelRef.current = null;
      } else {
        console.log(`[Realtime][DEBUG] Channel status: ${status}`, err);
      }
    });

    // Cleanup only on unmount
    return () => {
      // Channel cleanup removed to keep channel alive across navigation
    };
  }, [roomDetails?.id, handlePlayerChange, navigate, toast]);

  // Handle starting the game - UPDATED FLOW
  const handleStartGame = async () => {
    if (!roomDetails?.id || !isHost) {
      console.error("Cannot start game: Invalid room or not host", { roomId: roomDetails?.id, isHost });
      return;
    }

    try {
      setIsStartingGame(true);
      toast({ title: "Getting Ready", description: "Preparing questions..." });

      // 1. Update room to 'preparing' state
      console.log(`Updating room ${roomDetails.id} to 'preparing' state`);
      const { error: updateError } = await supabase
        .from('rooms')
        .update({ game_state: 'preparing' })
        .eq('id', roomDetails.id);

      if (updateError) {
        console.error("Error updating room to preparing state:", updateError);
        toast({ title: "Error", description: `Failed to start game`, variant: "destructive" });
        setIsStartingGame(false);
        return;
      }

      // 2. Call the Edge Function to generate and store questions
      console.log("Calling geminiQuiz Edge Function to generate and store questions...");
      const { data: response, error: functionError } = await supabase.functions
        .invoke('geminiQuiz', { 
          body: { 
            roomId: roomDetails.id,
            count: 2
          } 
        });

      if (functionError || !response || !response.success) {
        console.error("Error from geminiQuiz function:", functionError || response?.error);
        toast({ 
          title: "Error", 
          description: "Failed to generate questions. Please try again.", 
          variant: "destructive" 
        });
        
        // Reset room state on error
        await supabase
          .from('rooms')
          .update({ game_state: 'lobby' })
          .eq('id', roomDetails.id);
          
        setIsStartingGame(false);
        return;
      }
      
      console.log("Questions successfully generated and stored:", response);
      toast({ 
        title: "Questions Ready", 
        description: `Generated ${response.questionCount} questions` 
      });

      // 3. Now that questions are stored, update room to 'question_active'
      console.log('roomDetails.id:', `"${roomDetails.id}"`, typeof roomDetails.id);
      console.log(`Starting game: Updating room ${roomDetails.id} to question_active state`);
      const { data, error: activeError } = await supabase
        .from('rooms')
        .update({ 
          game_state: 'question_active',
          question_index: 0
        })
        .eq('id', roomDetails.id)
        .select();
      console.log('Update result:', data, activeError);

      if (activeError) {
        console.error("Error updating to question_active state:", activeError);
        toast({ title: "Error", description: `Failed to start game`, variant: "destructive" });
        // Reset room state on error
        await supabase
          .from('rooms')
          .update({ game_state: 'lobby' })
          .eq('id', roomDetails.id);
        setIsStartingGame(false);
        return;
      }

      console.log("Game start successful!");
      // Fallback navigation removed. Navigation now only happens via realtime event.
    } catch (err) {
      console.error("Unexpected error in handleStartGame:", err);
      toast({ title: "Error", description: "An unexpected error occurred", variant: "destructive" });
      
      // Reset room state on error
      if (roomDetails?.id) {
        await supabase
          .from('rooms')
          .update({ game_state: 'lobby' })
          .eq('id', roomDetails.id);
      }
      
      setIsStartingGame(false);
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
        isStartingGame={isStartingGame}
        onStartGame={handleStartGame}
      />
    </div>
  );
};

export default Room;


import React, { useState, useEffect, useCallback, useRef } from 'react';
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

  // Handle room state changes
  const handleRoomStateChange = useCallback((payload: any) => {
    console.log('[Realtime] Room update received:', payload);
    
    if (!payload.new || typeof payload.new.game_state !== 'string' || hasRedirectedRef.current) {
      return;
    }
    
    const newGameState = payload.new.game_state;
    console.log(`[Realtime] Room state changed to: ${newGameState}`);
    
    // CRITICAL PATH: Redirect to question view when game starts
    if (newGameState === 'question_active' && roomDetails?.id && !hasRedirectedRef.current) {
      console.log(`[Realtime] Game starting! Navigating to question view`);
      
      // Mark as redirected to prevent duplicate navigation
      hasRedirectedRef.current = true;
      
      toast({ 
        title: "Game Starting!", 
        description: "First question is ready!",
        variant: "default" 
      });
      
      // Add a slight delay to ensure the toast is seen
      setTimeout(() => {
        // Navigate with state containing the room ID
        navigate(`/question`, { 
          state: { roomId: roomDetails.id } 
        });
      }, 500);
    }
  }, [roomDetails?.id, navigate, toast]);

  // Set up realtime subscription for room status changes
  useEffect(() => {
    if (!roomDetails?.id) {
      console.log('[Realtime] Waiting for roomDetails.id before setting up subscription...');
      return;
    }

    if (channelRef.current) {
      console.log('[Realtime] Channel already exists, not creating a new one');
      return;
    }

    console.log(`[Realtime] Setting up subscription for room ID: ${roomDetails.id}`);
    
    // Create a unique channel name with room ID to avoid conflicts
    const channelName = `room-updates-${roomDetails.id}-${Date.now()}`;
    
    // Create a dedicated channel for this room
    const channel = supabase.channel(channelName, {
      config: { 
        broadcast: { self: true },
        presence: { key: '' },
      }
    });

    // Listen for room updates - especially game_state changes
    channel
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public', 
        table: 'rooms',
        filter: `id=eq.${roomDetails.id}`
      }, handleRoomStateChange)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'players',
        filter: `room_id=eq.${roomDetails.id}`
      }, handlePlayerChange)
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log(`[Realtime] Successfully subscribed to room updates for ${roomDetails.id}`);
          // Store the channel in the ref so we don't create multiple subscriptions
          channelRef.current = channel;
        } else {
          console.error(`[Realtime] Subscription error:`, status, err);
          channelRef.current = null;
          toast({ 
            title: "Connection Issue", 
            description: "Problem connecting to game updates. Please refresh.",
            variant: "destructive" 
          });
        }
      });

    // Fallback mechanism - if room state is 'question_active' but no realtime event fired
    // Check every 3 seconds for game state
    const fallbackInterval = setInterval(async () => {
      if (!roomDetails?.id || hasRedirectedRef.current) return;
      
      try {
        console.log('[Fallback] Checking room state...');
        const { data, error } = await supabase
          .from('rooms')
          .select('game_state')
          .eq('id', roomDetails.id)
          .single();
          
        if (error) {
          console.error('[Fallback] Error fetching room state:', error);
          return;
        }
        
        if (data.game_state === 'question_active' && !hasRedirectedRef.current) {
          console.log('[Fallback] Detected game_state=question_active through polling');
          
          // Mark as redirected to prevent duplicate navigation
          hasRedirectedRef.current = true;
          
          toast({ 
            title: "Game Starting!", 
            description: "First question is ready!"
          });
          
          navigate(`/question`, { 
            state: { roomId: roomDetails.id } 
          });
          
          clearInterval(fallbackInterval);
        }
      } catch (err) {
        console.error('[Fallback] Error in fallback check:', err);
      }
    }, 3000);

    // Cleanup function - only run this when component is ACTUALLY unmounting
    return () => {
      console.log(`[Realtime] Cleaning up subscription for room ${roomDetails.id}`);
      clearInterval(fallbackInterval);
      
      // Only clean up if we have a valid channel
      if (channelRef.current) {
        console.log('[Realtime] Removing channel...');
        supabase.removeChannel(channelRef.current).then(success => {
          console.log(`[Realtime] Channel cleanup ${success ? 'successful' : 'failed'}`);
          channelRef.current = null;
        });
      }
    };
  }, [roomDetails?.id, navigate, toast, handlePlayerChange, handleRoomStateChange]);

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
            count: 10
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
        
        // Reset room state on error
        await supabase
          .from('rooms')
          .update({ game_state: 'lobby' })
          .eq('id', roomDetails.id);
          
        setIsStartingGame(false);
        return;
      }

      console.log("Game start successful!");
      
      // If the redirect doesn't happen via the realtime event
      setTimeout(() => {
        if (roomDetails?.id && !hasRedirectedRef.current) {
          hasRedirectedRef.current = true;
          console.log("[Fallback] Using explicit navigation after game start");
          navigate(`/question`, { state: { roomId: roomDetails.id } });
        }
      }, 2000);
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

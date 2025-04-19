import React from 'react';
import { useNavigate } from 'react-router-dom'; // Keep useNavigate for potential future use directly in Index
import RoomForm from '../components/RoomForm';
import { supabase } from '../../lib/supabaseClient'; // Correct relative path from src/pages to root/lib
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Trophy, Users, Clock, Brain } from 'lucide-react';

// Function to generate a simple 6-char room code
function generateRoomCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Real implementation to create a room and host player in Supabase
const createRoom = async (playerName: string): Promise<string> => {
  const roomCode = generateRoomCode();
  console.log(`Attempting to create room with code: ${roomCode} for player: ${playerName}`);

  try {
    // 1. Create the room
    const { data: roomData, error: roomError } = await supabase
      .from('rooms')
      .insert({ code: roomCode })
      .select('id') // Only select the ID we need
      .single();

    if (roomError) {
      console.error('Supabase room insert error:', roomError);
      // Check for unique constraint violation (code already exists)
      if (roomError.code === '23505') { // Postgres unique violation code
        // Potentially retry with a new code, or inform user
        throw new Error('Room code conflict. Please try creating again.');
      }
      throw new Error(`Failed to create room: ${roomError.message}`);
    }
    if (!roomData) {
        throw new Error("Failed to create room (no data returned).");
    }

    console.log(`Room created successfully with ID: ${roomData.id}`);

    // 2. Create the host player AND select their ID
    const { data: hostPlayerData, error: playerError } = await supabase
      .from('players')
      .insert({
        room_id: roomData.id,
        name: playerName.trim(),
        is_host: true,
      })
      .select('id') // Select the new player ID
      .single();

    if (playerError || !hostPlayerData) {
      console.error('Supabase host player insert error:', playerError);
      console.log(`Attempting to delete room ${roomData.id} due to player creation failure.`);
      await supabase.from('rooms').delete().match({ id: roomData.id });
      throw new Error(`Failed to add host player: ${playerError?.message || 'Unknown error'}`);
    }

    // 3. Store the host player ID locally
    localStorage.setItem(`ggqt-roomId-${roomCode}`, roomData.id); // Store room ID too, might be useful
    localStorage.setItem(`ggqt-playerId-${roomData.id}`, hostPlayerData.id);
    console.log(`Host player ${playerName} (ID: ${hostPlayerData.id}) added to room ${roomCode}. Stored ID locally.`);
    
    // 4. Return the room code for navigation (handled by RoomForm)
    return roomCode;

  } catch (err) {
    console.error("Error in createRoom function:", err);
    throw err;
  }
};

// Real implementation to join an existing room
const joinRoom = async (roomCode: string, playerName: string): Promise<void> => {
  const upperCaseRoomCode = roomCode.toUpperCase();
  console.log(`Attempting to join room: ${upperCaseRoomCode} as player: ${playerName}`);

  try {
    // 1. Find the room by code
    const { data: roomData, error: roomError } = await supabase
      .from('rooms')
      .select('id, game_state') // Select ID and game state
      .eq('code', upperCaseRoomCode)
      .single();

    if (roomError) {
      // If error is 'PGRST116', it means no rows were found
      if (roomError.code === 'PGRST116') {
        console.error(`Room with code ${upperCaseRoomCode} not found.`);
        throw new Error(`Invalid room code: ${upperCaseRoomCode}`);
      } else {
        console.error('Supabase room select error:', roomError);
        throw new Error(`Failed to find room: ${roomError.message}`);
      }
    }

    if (!roomData) {
      throw new Error(`Invalid room code: ${upperCaseRoomCode}`);
    }

    // Optional: Check if game is already in progress or finished (depending on desired logic)
    // if (roomData.game_state !== 'lobby') {
    //   throw new Error('Game has already started or finished.');
    // }

    console.log(`Found room ${upperCaseRoomCode} with ID: ${roomData.id}`);

    // 2. Add the player to the room AND select their ID
    const { data: joiningPlayerData, error: playerError } = await supabase
      .from('players')
      .insert({
        room_id: roomData.id,
        name: playerName.trim(),
        is_host: false,
      })
      .select('id') // Select the new player ID
      .single();

    if (playerError || !joiningPlayerData) {
      console.error('Supabase joining player insert error:', playerError);
      throw new Error(`Failed to join room: ${playerError?.message || 'Unknown error'}`);
    }

    // 3. Store the joining player ID locally
    localStorage.setItem(`ggqt-roomId-${upperCaseRoomCode}`, roomData.id);
    localStorage.setItem(`ggqt-playerId-${roomData.id}`, joiningPlayerData.id);
    console.log(`Player ${playerName} (ID: ${joiningPlayerData.id}) successfully joined room ${upperCaseRoomCode}. Stored ID locally.`);
    
    // Navigation is handled by RoomForm, so we just return successfully
    return;

  } catch (err) {
    console.error("Error in joinRoom function:", err);
    throw err;
  }
};

const Index: React.FC = () => {
  // const navigate = useNavigate(); // Keep for potential future use

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-4 bg-gradient-to-b from-purple-50 to-white dark:from-gray-900 dark:to-gray-800">
      <div className="w-full max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2 text-transparent bg-clip-text football-gradient">
            Football Trivia Quiz Time
          </h1>
          <p className="text-lg text-muted-foreground">
            Challenge your friends with the ultimate football knowledge test!
          </p>
        </div>
        
        <div className="grid md:grid-cols-2 gap-8 mb-8">
          <div>
            <RoomForm 
              onCreateRoom={createRoom} 
              onJoinRoom={joinRoom} 
            />
          </div>
          
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Trophy className="h-5 w-5 mr-2 text-yellow-500" />
                  How to Play
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="bg-primary/10 p-2 rounded-full">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-medium">Create or Join a Room</h3>
                    <p className="text-sm text-muted-foreground">
                      Start a new game or join friends with a room code
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="bg-primary/10 p-2 rounded-full">
                    <Brain className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-medium">Answer Questions</h3>
                    <p className="text-sm text-muted-foreground">
                      Test your football knowledge with trivia from 2000-2025
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="bg-primary/10 p-2 rounded-full">
                    <Clock className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-medium">Be Fast & Accurate</h3>
                    <p className="text-sm text-muted-foreground">
                      Score points based on speed and correctness
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <p className="italic text-sm text-muted-foreground">
                  "Covering the top-5 European leagues from 2000-2025, our trivia questions 
                  challenge even the most dedicated football fans. Perfect for game nights!"
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;

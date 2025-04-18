
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle 
} from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Plus, Users } from 'lucide-react';

type RoomFormProps = {
  onCreateRoom: (playerName: string) => Promise<string>;
  onJoinRoom: (roomCode: string, playerName: string) => Promise<void>;
};

const RoomForm: React.FC<RoomFormProps> = ({ onCreateRoom, onJoinRoom }) => {
  const [activeTab, setActiveTab] = useState<'create' | 'join'>('create');
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!playerName.trim()) {
      setError('Please enter your name');
      return;
    }
    
    try {
      setIsLoading(true);
      
      if (activeTab === 'create') {
        const roomId = await onCreateRoom(playerName);
        navigate(`/room/${roomId}`);
      } else {
        if (!roomCode.trim()) {
          setError('Please enter a room code');
          return;
        }
        await onJoinRoom(roomCode, playerName);
        navigate(`/room/${roomCode}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto animate-fade-in">
      <CardHeader>
        <CardTitle className="text-xl font-bold">
          {activeTab === 'create' ? 'Create a New Room' : 'Join Existing Room'}
        </CardTitle>
        <CardDescription>
          {activeTab === 'create' 
            ? 'Start a new football trivia quiz with friends' 
            : 'Enter a room code to join your friends'}
        </CardDescription>
      </CardHeader>
      
      <div className="flex border-b mb-4">
        <button
          className={`flex-1 py-2 text-center font-medium transition-colors ${
            activeTab === 'create' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground'
          }`}
          onClick={() => setActiveTab('create')}
        >
          <Plus size={18} className="inline mr-2" />
          Create
        </button>
        <button
          className={`flex-1 py-2 text-center font-medium transition-colors ${
            activeTab === 'join' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground'
          }`}
          onClick={() => setActiveTab('join')}
        >
          <Users size={18} className="inline mr-2" />
          Join
        </button>
      </div>
      
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="playerName" className="text-sm font-medium">
              Your Name
            </label>
            <Input
              id="playerName"
              placeholder="Enter your name"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              disabled={isLoading}
            />
          </div>
          
          {activeTab === 'join' && (
            <div className="space-y-2">
              <label htmlFor="roomCode" className="text-sm font-medium">
                Room Code
              </label>
              <Input
                id="roomCode"
                placeholder="Enter room code"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                disabled={isLoading}
              />
            </div>
          )}
          
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </CardContent>
        
        <CardFooter>
          <Button 
            type="submit" 
            className="w-full group" 
            disabled={isLoading}
          >
            {isLoading ? 'Please wait...' : activeTab === 'create' ? 'Create Room' : 'Join Room'}
            <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
};

export default RoomForm;

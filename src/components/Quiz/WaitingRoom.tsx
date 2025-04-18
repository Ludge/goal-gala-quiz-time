
import React, { useState } from 'react';
import { 
  Card, 
  CardContent, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { 
  Copy, 
  Users, 
  PlayCircle, 
  Share2, 
  ThumbsUp, 
  Coffee 
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type Player = {
  id: string;
  name: string;
};

type WaitingRoomProps = {
  roomCode: string;
  players: Player[];
  isHost: boolean;
  onStartGame: () => void;
};

const WaitingRoom: React.FC<WaitingRoomProps> = ({
  roomCode,
  players,
  isHost,
  onStartGame
}) => {
  const [isCopied, setIsCopied] = useState(false);
  const { toast } = useToast();
  
  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
      toast({
        title: "Code copied!",
        description: "Share it with your friends to invite them",
      });
    });
  };
  
  const shareRoom = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join my Football Trivia Quiz!',
          text: `Join my game with code: ${roomCode}`,
          url: `${window.location.origin}/room/${roomCode}`,
        });
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError') {
          console.error('Error sharing:', err);
        }
      }
    } else {
      copyRoomCode();
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto animate-fade-in">
      <CardHeader>
        <CardTitle className="text-xl font-bold">Waiting Room</CardTitle>
      </CardHeader>
      
      <CardContent>
        <div className="bg-muted/50 p-4 rounded-lg flex items-center justify-between mb-6">
          <div>
            <div className="text-sm text-muted-foreground">Room Code</div>
            <div className="text-2xl font-bold tracking-wider">{roomCode}</div>
          </div>
          
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="icon" 
              onClick={copyRoomCode}
              className="h-10 w-10"
            >
              <Copy className={`h-4 w-4 ${isCopied ? 'text-green-500' : ''}`} />
            </Button>
            
            <Button 
              variant="outline" 
              size="icon" 
              onClick={shareRoom}
              className="h-10 w-10"
            >
              <Share2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        <div className="mb-4">
          <div className="flex items-center mb-2">
            <Users className="h-4 w-4 mr-2" />
            <h3 className="font-medium">Players ({players.length})</h3>
          </div>
          
          <div className="bg-background rounded-lg border overflow-hidden">
            {players.length > 0 ? (
              <div className="divide-y">
                {players.map((player, index) => (
                  <div key={player.id} className="p-3 flex items-center">
                    <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-medium mr-3">
                      {player.name.charAt(0).toUpperCase()}
                    </div>
                    <span>{player.name}</span>
                    {index === 0 && (
                      <span className="ml-auto text-xs px-2 py-1 bg-primary/10 text-primary rounded-full">
                        Host
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 text-center text-muted-foreground">
                <Coffee className="h-12 w-12 mx-auto mb-2 opacity-30" />
                <p>Waiting for players to join...</p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
      
      <CardFooter className="flex flex-col gap-3">
        {isHost ? (
          <>
            <Button 
              className="w-full" 
              disabled={players.length < 1}
              onClick={onStartGame}
            >
              <PlayCircle className="mr-2 h-4 w-4" />
              Start Game
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              As the host, you can start the game when everyone is ready
            </p>
          </>
        ) : (
          <>
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <ThumbsUp className="h-4 w-4" />
              <span>Waiting for host to start the game...</span>
            </div>
          </>
        )}
      </CardFooter>
    </Card>
  );
};

export default WaitingRoom;

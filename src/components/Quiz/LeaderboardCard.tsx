
import React from 'react';
import { 
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Medal, Clock, CheckCircle, XCircle } from 'lucide-react';

type Player = {
  id: string;
  name: string;
  score: number;
  correctAnswers: number;
  totalAnswers: number;
  averageTime: number;
};

type LeaderboardCardProps = {
  players: Player[];
  isFinal?: boolean;
};

const LeaderboardCard: React.FC<LeaderboardCardProps> = ({ 
  players, 
  isFinal = false 
}) => {
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
  
  const getPosition = (index: number) => {
    if (index === 0) return <Medal className="h-5 w-5 text-yellow-500" />;
    if (index === 1) return <Medal className="h-5 w-5 text-gray-400" />;
    if (index === 2) return <Medal className="h-5 w-5 text-amber-700" />;
    return <span className="h-5 w-5 inline-flex items-center justify-center">{index + 1}</span>;
  };

  return (
    <Card className="w-full animate-fade-in">
      <CardHeader>
        <CardTitle className="text-xl">
          {isFinal ? 'Final Leaderboard' : 'Current Standings'}
        </CardTitle>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-4">
          {sortedPlayers.map((player, index) => (
            <div 
              key={player.id}
              className={`flex items-center p-3 rounded-lg ${
                index === 0 ? 'bg-yellow-50 dark:bg-yellow-900/20' : 
                index === 1 ? 'bg-gray-50 dark:bg-gray-800/50' : 
                index === 2 ? 'bg-amber-50 dark:bg-amber-900/20' : 
                'bg-muted/50'
              }`}
            >
              <div className="flex items-center justify-center w-8 mr-3">
                {getPosition(index)}
              </div>
              
              <div className="flex-1">
                <div className="font-medium truncate">{player.name}</div>
                
                {isFinal && (
                  <div className="flex space-x-3 text-sm text-muted-foreground mt-1">
                    <span className="flex items-center">
                      <CheckCircle className="h-3 w-3 mr-1 text-green-500" />
                      {player.correctAnswers}/{player.totalAnswers}
                    </span>
                    
                    <span className="flex items-center">
                      <Clock className="h-3 w-3 mr-1" />
                      {(player.averageTime / 1000).toFixed(1)}s avg
                    </span>
                  </div>
                )}
              </div>
              
              <div className="font-bold text-lg">
                {player.score} {!isFinal && 'pts'}
              </div>
            </div>
          ))}
          
          {players.length === 0 && (
            <div className="text-center py-6 text-muted-foreground">
              No players yet
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default LeaderboardCard;


import React from 'react';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, Clock } from 'lucide-react';

// Define the structure of a leaderboard entry
export type LeaderboardEntry = {
  player_id: string;
  player_name: string;
  correct_answers: number;
  total_time_ms: number;
};

interface LeaderboardDisplayProps {
  leaderboardData: LeaderboardEntry[];
  title?: string;
  currentUserId?: string | null; // Optional: To highlight the current user
}

const LeaderboardDisplay: React.FC<LeaderboardDisplayProps> = ({ 
  leaderboardData, 
  title = "Leaderboard",
  currentUserId 
}) => {
  // Format time from milliseconds to seconds with one decimal place
  const formatTime = (ms: number) => {
    if (ms === 0) return '-'; // Handle cases where time is 0 (e.g., no correct answers)
    return (ms / 1000).toFixed(1) + 's';
  };

  return (
    <Card className="w-full max-w-xl animate-fade-in">
      <CardHeader>
        <CardTitle className="text-center text-2xl flex items-center justify-center">
          <Trophy className="mr-2 h-6 w-6 text-yellow-500" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px] text-center">Rank</TableHead>
              <TableHead>Player</TableHead>
              <TableHead className="text-right">Correct</TableHead>
              <TableHead className="text-right w-[100px]">
                <div className="flex items-center justify-end">
                  <Clock className="h-4 w-4 mr-1" /> Time
                </div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leaderboardData && leaderboardData.length > 0 ? (
              leaderboardData.map((entry, index) => (
                <TableRow 
                  key={entry.player_id} 
                  className={entry.player_id === currentUserId ? 'bg-muted/50 font-semibold' : ''}
                >
                  <TableCell className="text-center font-medium">{index + 1}</TableCell>
                  <TableCell>{entry.player_name}</TableCell>
                  <TableCell className="text-right">{entry.correct_answers}</TableCell>
                  <TableCell className="text-right">{formatTime(entry.total_time_ms)}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center">
                  No scores yet. Answer the first question!
                </TableCell>
              </TableRow>
            )}
          </TableBody>
          {leaderboardData && leaderboardData.length > 0 && (
             <TableCaption>Ranking based on correct answers, then total time for correct answers.</TableCaption>
          )}
        </Table>
      </CardContent>
    </Card>
  );
};

export default LeaderboardDisplay; 

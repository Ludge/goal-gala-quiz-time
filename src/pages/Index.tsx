
import React, { useState } from 'react';
import RoomForm from '@/components/RoomForm';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Trophy, Users, Clock, Brain } from 'lucide-react';

// This function would connect to Supabase and create a room
const createRoom = async (playerName: string): Promise<string> => {
  // For now, return a dummy room code - we'll implement this with Supabase later
  return 'ABC123';
};

// This function would connect to Supabase and join a room
const joinRoom = async (roomCode: string, playerName: string): Promise<void> => {
  // We'll implement this with Supabase later
  return Promise.resolve();
};

const Index: React.FC = () => {
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

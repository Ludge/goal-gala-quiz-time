
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import WaitingRoom from '@/components/Quiz/WaitingRoom';
import QuestionCard from '@/components/Quiz/QuestionCard';
import LeaderboardCard from '@/components/Quiz/LeaderboardCard';
import EmojiReactionPanel from '@/components/Quiz/EmojiReactionPanel';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Home, ChevronRight } from 'lucide-react';

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

const mockPlayers = [
  { id: '1', name: 'Host Player', score: 120, correctAnswers: 2, totalAnswers: 3, averageTime: 5200 },
  { id: '2', name: 'John', score: 90, correctAnswers: 1, totalAnswers: 3, averageTime: 6800 },
  { id: '3', name: 'Sarah', score: 150, correctAnswers: 3, totalAnswers: 3, averageTime: 4500 },
];

// Game states
type GameState = 'waiting' | 'playing' | 'review' | 'finished';

const Room: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // States for game management
  const [gameState, setGameState] = useState<GameState>('waiting');
  const [players, setPlayers] = useState(mockPlayers);
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
  
  // Set a player as host for demo purposes
  const isHost = true;
  
  // Handle starting the game
  const handleStartGame = () => {
    setGameState('playing');
    toast({
      title: "Game started!",
      description: "First question coming up...",
    });
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
  const handleNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setShowCorrectAnswer(false);
      setUserAnswer(null);
    } else {
      setGameState('finished');
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
    switch (gameState) {
      case 'waiting':
        return (
          <WaitingRoom
            roomCode={roomId || 'ERROR'}
            players={players}
            isHost={isHost}
            onStartGame={handleStartGame}
          />
        );
        
      case 'playing':
        return (
          <div className="w-full max-w-2xl mx-auto">
            <div className="mb-4 flex justify-between items-center">
              <div>
                <span className="text-sm text-muted-foreground">Question</span>
                <h2 className="text-lg font-bold">
                  {currentQuestionIndex + 1}/{questions.length}
                </h2>
              </div>
              
              {showCorrectAnswer && (
                <Button onClick={handleNextQuestion}>
                  {currentQuestionIndex < questions.length - 1 ? (
                    <>
                      Next Question
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </>
                  ) : (
                    "View Final Results"
                  )}
                </Button>
              )}
            </div>
            
            <QuestionCard
              question={questions[currentQuestionIndex]}
              timeLimit={15}
              onAnswer={handleAnswer}
              showCorrectAnswer={showCorrectAnswer}
              userAnswer={userAnswer}
              timeElapsed={timeElapsed}
            />
            
            {showCorrectAnswer && (
              <div className="mt-6">
                <LeaderboardCard players={players} />
              </div>
            )}
          </div>
        );
        
      case 'finished':
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

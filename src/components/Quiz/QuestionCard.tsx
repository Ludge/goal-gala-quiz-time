
import React, { useState, useEffect } from 'react';
import { 
  Card, 
  CardContent, 
  CardFooter,
  CardHeader,
  CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, Clock } from 'lucide-react';
import { Confetti } from '../ui/Confetti';

type Question = {
  id: string;
  text: string;
  options: string[];
  correctOptionIndex: number;
};

type QuestionCardProps = {
  question: Question;
  timeLimit: number;
  onAnswer: (optionIndex: number, timeElapsed: number) => void;
  showCorrectAnswer: boolean;
  userAnswer?: number | null;
  timeElapsed?: number;
};

const QuestionCard: React.FC<QuestionCardProps> = ({
  question,
  timeLimit,
  onAnswer,
  showCorrectAnswer,
  userAnswer,
  timeElapsed
}) => {
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(timeLimit);
  const [showConfetti, setShowConfetti] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  
  useEffect(() => {
    // Reset state when question changes
    setSelectedOption(null);
    setTimeRemaining(timeLimit);
    setStartTime(Date.now());
    
    if (!showCorrectAnswer) {
      const timer = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 0 || selectedOption !== null) {
            clearInterval(timer);
            if (prev <= 0 && selectedOption === null) {
              const elapsed = Date.now() - (startTime || Date.now());
              onAnswer(-1, elapsed); // No answer selected, send -1
            }
            return 0;
          }
          return prev - 0.1;
        });
      }, 100);
      
      return () => clearInterval(timer);
    }
  }, [question.id, timeLimit, showCorrectAnswer]);
  
  useEffect(() => {
    if (showCorrectAnswer && userAnswer === question.correctOptionIndex) {
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 3000);
    }
  }, [showCorrectAnswer]);
  
  const handleOptionClick = (optionIndex: number) => {
    if (selectedOption !== null || showCorrectAnswer) return;
    
    setSelectedOption(optionIndex);
    const elapsed = Date.now() - (startTime || Date.now());
    onAnswer(optionIndex, elapsed);
  };
  
  const getOptionClassName = (index: number) => {
    let className = "answer-option";
    
    if (showCorrectAnswer) {
      if (index === question.correctOptionIndex) {
        className += " correct";
      } else if (userAnswer === index) {
        className += " incorrect";
      }
    } else if (selectedOption === index) {
      className += " selected";
    }
    
    return className;
  };
  
  const renderTimerBar = () => {
    if (showCorrectAnswer) return null;
    
    const percentRemaining = (timeRemaining / timeLimit) * 100;
    return (
      <div className="timer-bar mt-4">
        <div 
          className="bg-primary h-full transition-all duration-100" 
          style={{ width: `${percentRemaining}%` }}
        />
      </div>
    );
  };

  return (
    <>
      {showConfetti && <Confetti />}
      <Card className="w-full animate-fade-in">
        <CardHeader>
          <div className="flex justify-between items-center mb-2">
            <CardTitle className="text-xl">{question.text}</CardTitle>
          </div>
          {renderTimerBar()}
        </CardHeader>
        
        <CardContent className="space-y-3">
          {question.options.map((option, index) => (
            <div
              key={index}
              className={getOptionClassName(index)}
              onClick={() => handleOptionClick(index)}
            >
              <span className="w-8 h-8 rounded-full bg-muted flex items-center justify-center mr-3">
                {String.fromCharCode(65 + index)}
              </span>
              <span className="flex-1">{option}</span>
              {showCorrectAnswer && index === question.correctOptionIndex && (
                <CheckCircle className="ml-2 text-green-500" />
              )}
              {showCorrectAnswer && userAnswer === index && index !== question.correctOptionIndex && (
                <XCircle className="ml-2 text-red-500" />
              )}
            </div>
          ))}
        </CardContent>
        
        {showCorrectAnswer && (
          <CardFooter className="flex justify-between items-center text-sm text-muted-foreground">
            <div className="flex items-center">
              <Clock className="h-4 w-4 mr-1" />
              {timeElapsed ? `${(timeElapsed / 1000).toFixed(1)}s` : "Time's up!"}
            </div>
            
            <div>
              {userAnswer === question.correctOptionIndex ? (
                <span className="text-green-500 font-medium flex items-center">
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Correct!
                </span>
              ) : (
                <span className="text-red-500 font-medium flex items-center">
                  <XCircle className="h-4 w-4 mr-1" />
                  {userAnswer === -1 ? "Time's up!" : "Incorrect"}
                </span>
              )}
            </div>
          </CardFooter>
        )}
      </Card>
    </>
  );
};

export default QuestionCard;

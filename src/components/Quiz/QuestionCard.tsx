
import React from 'react';
import { 
  Card, 
  CardContent, 
  CardFooter,
  CardHeader,
  CardTitle 
} from '@/components/ui/card';
import { CheckCircle, XCircle, Clock } from 'lucide-react';
import { Confetti } from '../ui/Confetti';

type QuestionCardProps = {
  question: string;
  options: string[];
  timeRemaining: number;
  onSelectOption: (optionIndex: number) => void;
  selectedOption: number | null;
  correctOptionIndex?: number;
  questionNumber: number;
  totalQuestions: number;
};

const QuestionCard: React.FC<QuestionCardProps> = ({
  question,
  options,
  timeRemaining,
  onSelectOption,
  selectedOption,
  correctOptionIndex,
  questionNumber,
  totalQuestions
}) => {
  const isAnswered = correctOptionIndex !== undefined;
  const showConfetti = isAnswered && selectedOption === correctOptionIndex;
  
  const getOptionClassName = (index: number) => {
    let className = "p-4 mb-3 border rounded-lg flex items-center cursor-pointer hover:bg-muted/50 transition-colors";
    
    if (isAnswered) {
      if (index === correctOptionIndex) {
        className += " border-green-500 bg-green-50 dark:bg-green-900/20";
      } else if (selectedOption === index) {
        className += " border-red-500 bg-red-50 dark:bg-red-900/20";
      }
    } else if (selectedOption === index) {
      className += " border-primary bg-primary/10";
    }
    
    return className;
  };

  return (
    <>
      {showConfetti && <Confetti />}
      <Card className="w-full max-w-xl animate-fade-in">
        <CardHeader>
          <div className="flex justify-between items-center mb-2">
            <div className="text-sm text-muted-foreground">
              Question {questionNumber} of {totalQuestions}
            </div>
            <div className="flex items-center">
              <Clock className="h-4 w-4 mr-1 text-muted-foreground" />
              <span className={`font-medium ${timeRemaining < 10 ? 'text-red-500' : ''}`}>
                {timeRemaining}s
              </span>
            </div>
          </div>
          <CardTitle className="text-xl">{question}</CardTitle>
          <div className="w-full bg-muted h-2 mt-4 rounded-full overflow-hidden">
            <div 
              className="bg-primary h-full transition-all duration-100" 
              style={{ width: `${(timeRemaining / 30) * 100}%` }}
            />
          </div>
        </CardHeader>
        
        <CardContent className="space-y-3">
          {options.map((option, index) => (
            <div
              key={index}
              className={getOptionClassName(index)}
              onClick={() => !isAnswered && onSelectOption(index)}
            >
              <span className="w-8 h-8 rounded-full bg-muted flex items-center justify-center mr-3">
                {String.fromCharCode(65 + index)}
              </span>
              <span className="flex-1">{option}</span>
              {isAnswered && index === correctOptionIndex && (
                <CheckCircle className="ml-2 text-green-500" />
              )}
              {isAnswered && selectedOption === index && index !== correctOptionIndex && (
                <XCircle className="ml-2 text-red-500" />
              )}
            </div>
          ))}
        </CardContent>
        
        {isAnswered && (
          <CardFooter className="justify-center pt-4">
            {selectedOption === correctOptionIndex ? (
              <div className="text-green-500 font-medium flex items-center">
                <CheckCircle className="h-5 w-5 mr-2" />
                Correct Answer!
              </div>
            ) : (
              <div className="text-red-500 font-medium flex items-center">
                <XCircle className="h-5 w-5 mr-2" />
                {selectedOption === -1 ? "Time's up!" : "Incorrect Answer"}
              </div>
            )}
          </CardFooter>
        )}
      </Card>
    </>
  );
};

export default QuestionCard;

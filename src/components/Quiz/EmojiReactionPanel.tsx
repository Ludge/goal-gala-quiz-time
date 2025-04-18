
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { 
  ChevronUp, 
  ChevronDown, 
  Smile, 
  ThumbsUp, 
  ThumbsDown, 
  Award, 
  Fire, 
  PartyPopper
} from 'lucide-react';

type Emoji = {
  id: string;
  emoji: string;
  name: string;
  count: number;
};

type EmojiReactionPanelProps = {
  onSendReaction: (emojiId: string) => void;
  reactionCounts: Record<string, number>;
};

const EMOJIS = [
  { id: 'clap', emoji: '👏', name: 'Clap', icon: ThumbsUp },
  { id: 'laugh', emoji: '😂', name: 'Laugh', icon: Smile },
  { id: 'sad', emoji: '😢', name: 'Sad', icon: ThumbsDown },
  { id: 'wow', emoji: '😮', name: 'Wow', icon: Award },
  { id: 'fire', emoji: '🔥', name: 'Fire', icon: Fire },
  { id: 'party', emoji: '🎉', name: 'Party', icon: PartyPopper },
];

const EmojiReactionPanel: React.FC<EmojiReactionPanelProps> = ({
  onSendReaction,
  reactionCounts,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const togglePanel = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className="flex flex-col items-end space-y-2">
        {isExpanded && (
          <div className="flex flex-col bg-background border rounded-xl p-2 shadow-lg animate-fade-in">
            <div className="grid grid-cols-3 gap-2">
              {EMOJIS.map((emoji) => (
                <Button
                  key={emoji.id}
                  variant="ghost"
                  size="sm"
                  className="flex flex-col items-center p-2 h-auto relative"
                  onClick={() => onSendReaction(emoji.id)}
                >
                  <span className="text-xl mb-1">{emoji.emoji}</span>
                  <span className="text-xs">{emoji.name}</span>
                  {reactionCounts[emoji.id] > 0 && (
                    <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center">
                      {reactionCounts[emoji.id]}
                    </span>
                  )}
                </Button>
              ))}
            </div>
          </div>
        )}
        
        <Button
          variant="outline"
          size="icon"
          className="h-10 w-10 rounded-full shadow-md"
          onClick={togglePanel}
        >
          {isExpanded ? (
            <ChevronDown className="h-5 w-5" />
          ) : (
            <>
              <Smile className="h-5 w-5" />
              {Object.values(reactionCounts).some(count => count > 0) && (
                <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {Object.values(reactionCounts).reduce((sum, count) => sum + count, 0)}
                </span>
              )}
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

export default EmojiReactionPanel;

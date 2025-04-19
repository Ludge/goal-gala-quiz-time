import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders } from '../_shared/cors.ts'

// Placeholder for Gemini API call
async function generateQuestionsFromAI(count: number): Promise<any[]> {
  console.log(`Generating ${count} questions (using placeholder data)...`);
  // In a real implementation, you would call the Gemini API here
  // based on the prompt in PRD.md

  // Example placeholder data structure
  const sampleQuestions = [
    {
      question: "Which club won the UEFA Champions League in 2005 after being 3-0 down at halftime?",
      options: ["AC Milan", "Liverpool", "Manchester United", "Real Madrid"],
      correct_option_index: 1
    },
    {
      question: "Who scored the winning goal for Germany in the 2014 FIFA World Cup Final?",
      options: ["Thomas Müller", "Miroslav Klose", "Mario Götze", "Mesut Özil"],
      correct_option_index: 2
    },
    {
        question: "Which player holds the record for the most goals scored in a single Premier League season (38 games)?",
        options: ["Alan Shearer", "Cristiano Ronaldo", "Mohamed Salah", "Erling Haaland"],
        correct_option_index: 3
    }
  ];

  // Return a subset based on count, or repeat if count > samples
  const result = [];
  for (let i = 0; i < count; i++) {
    result.push(sampleQuestions[i % sampleQuestions.length]);
  }
  return result;
}

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Extract count from request body or default to 5
    const { count = 5 } = await req.json();

    if (typeof count !== 'number' || count <= 0) {
        return new Response(JSON.stringify({ error: 'Invalid count parameter. Must be a positive number.' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        });
    }

    // Generate questions using the placeholder function
    const questions = await generateQuestionsFromAI(count);

    return new Response(
      JSON.stringify({ questions }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    );
  } catch (error) {
    console.error("Error in generate-questions function:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
}); 
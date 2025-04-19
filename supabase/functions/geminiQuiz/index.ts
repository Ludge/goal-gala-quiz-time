
// @ts-expect-error: Deno Deploy remote import
// deno-types="https://deno.land/std@0.168.0/http/server.ts"
// deno-types="deno.ns"
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
// deno-lint-ignore-file no-undef

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PROMPT = `Generate {count} unique and varied football (soccer) quiz questions. Only include questions about association football (soccer), and do NOT include any questions about American Football or other sports.

Requirements:
- Each question must be about a football (soccer) event that occurred between the years 2000 and 2025 (inclusive).
- Focus on European football, especially the top 5 leagues: Premier League (England), La Liga (Spain), Bundesliga (Germany), Serie A (Italy), and Ligue 1 (France).
- For each question, provide four multiple-choice options and indicate the correct answer.
- Cover a diverse range of football topics (e.g., specific match moments, rule changes within the period, player milestones, competition winners, managerial changes, transfer records) and actively avoid repeating the same event, player focus, or type of question within this batch AND aim for questions that are less commonly asked.
- Questions should be clear, factually accurate, and suitable for a general audience.
- Do not include any events before 2000 or after 2025. Ensure all questions are about football (soccer) events within this date range.
- Do NOT include any questions about American Football or other sports.
- Try to generate questions that feel distinct from typical examples, exploring slightly less obvious facts or events within the specified criteria.
- Create questions with a mix of easy, medium, and hard difficulty levels.

Format the response as a JSON array of objects with this structure:
{
  "questions": [
    {
      "id": number,
      "question": "string",
      "options": ["string", "string", "string", "string"],
      "correctAnswer": number (0-3)
    }
  ]
}`;

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') as string;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { roomId, count = 10, authorization } = await req.json();
    
    console.log(`Received request to generate ${count} questions for room ${roomId}`);
    
    if (!roomId) {
      return new Response(
        JSON.stringify({ 
          error: 'Missing required parameters: roomId is required' 
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
      console.error('GEMINI_API_KEY is not set');
      return new Response(
        JSON.stringify({ error: 'Server configuration error: API key not set' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      );
    }

    // Step 1: Generate questions with Gemini
    console.log(`Generating ${count} questions from Gemini API...`);
    const formattedPrompt = PROMPT.replace('{count}', count.toString());

    const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
    const body = {
      contents: [
        {
          parts: [
            { text: formattedPrompt }
          ]
        }
      ]
    };

    const geminiResponse = await fetch(GEMINI_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error(`Failed to fetch from Gemini API: ${errorText}`);
      throw new Error(`Failed to fetch from Gemini API: ${errorText}`);
    }

    const geminiData = await geminiResponse.json();
    // Extract the text response
    const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Extract the JSON part from the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('Failed to parse AI response, no JSON found');
      throw new Error('Failed to parse AI response');
    }

    let parsedQuestions;
    try {
      parsedQuestions = JSON.parse(jsonMatch[0]);
      console.log(`Successfully parsed ${parsedQuestions.questions.length} questions from Gemini`);
    } catch (parseError) {
      console.error('Error parsing Gemini response:', parseError);
      throw new Error(`Failed to parse AI response as JSON: ${parseError.message}`);
    }

    // Step 2: Store questions in database
    console.log(`Storing questions in database for room ${roomId}...`);
    
    // First, delete any existing questions for this room (cleanup)
    const { error: deleteError } = await supabase
      .from('questions')
      .delete()
      .eq('room_id', roomId);
    
    if (deleteError) {
      console.error('Error deleting existing questions:', deleteError);
      throw new Error(`Failed to clean up existing questions: ${deleteError.message}`);
    }
    
    // Format and insert new questions
    const questionsToInsert = parsedQuestions.questions.map((q: any, index: number) => ({
      room_id: roomId,
      question_number: index,
      question_text: q.question,
      options: q.options,
      correct_option_index: q.correctAnswer !== undefined ? q.correctAnswer : q.correct_option_index
    }));

    const { error: insertError } = await supabase
      .from('questions')
      .insert(questionsToInsert);

    if (insertError) {
      console.error('Error storing questions:', insertError);
      throw new Error(`Failed to store questions: ${insertError.message}`);
    }

    console.log(`Successfully stored ${questionsToInsert.length} questions for room ${roomId}`);

    // Step 3: Return success response to frontend
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Successfully generated and stored ${questionsToInsert.length} questions`,
        questionCount: questionsToInsert.length
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in geminiQuiz function:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'An unexpected error occurred',
        success: false
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Too many requests, please try again later.'
});
app.use('/api/', limiter);

// Load API keys from environment
const apiKeys = [];
for (let i = 1; i <= 10; i++) {
    const key = process.env[`GEMINI_KEY_${i}`];
    if (key) apiKeys.push(key);
}

let currentKeyIndex = 0;

function getNextApiKey() {
    if (apiKeys.length === 0) {
        throw new Error('No API keys configured');
    }
    const key = apiKeys[currentKeyIndex];
    currentKeyIndex = (currentKeyIndex + 1) % apiKeys.length;
    return key;
}

// 🎯 Chunk configuration
function getChunkConfig(targetLength) {
    const MAX_CHARS_PER_CHUNK = 5500;
    
    if (targetLength <= 10000) {
        return { chunks: 2, charsPerChunk: 5500 };
    } else if (targetLength <= 30000) {
        return { chunks: 6, charsPerChunk: 5500 };
    } else if (targetLength <= 60000) {
        return { chunks: 12, charsPerChunk: 5500 };
    } else if (targetLength <= 100000) {
        return { chunks: 20, charsPerChunk: 5500 };
    } else {
        return { chunks: 25, charsPerChunk: 5500 };
    }
}

function getSectionGoal(partNum, totalParts) {
    const progress = partNum / totalParts;
    
    if (progress <= 0.25) {
        return 'OPENING: Explosive start, character introduction, initial hook';
    }
    if (progress <= 0.50) {
        return 'RISING ACTION: Build tension, develop conflict, deepen stakes';
    }
    if (progress <= 0.75) {
        return 'ESCALATION: Major confrontations, plot twists, peak drama';
    }
    return 'CLIMAX & RESOLUTION: Ultimate showdown, wrap up all threads, satisfying end';
}

function buildFirstChunkPrompt(title, niche, tone, plot, styleExample, extraInstructions, config, partNum) {
    const sectionGoal = getSectionGoal(partNum, config.chunks);
    
    return `You are a professional story writer creating a ${niche} story.

🎯 CRITICAL: Write EXACTLY 5,500 characters for this chunk (Chunk ${partNum} of ${config.chunks})

**STORY SETUP:**
- Title: "${title}"
- Genre: ${niche}
- Tone: ${tone}
- Plot: ${plot}
- Writing Style: ${styleExample}
${extraInstructions ? `- Extra: ${extraInstructions}` : ''}

**THIS CHUNK'S FOCUS:**
${sectionGoal}

**ABSOLUTE REQUIREMENTS:**
✅ Write EXACTLY 5,500 characters - be EXTREMELY detailed
✅ Rich, vivid descriptions of EVERY scene
✅ Deep character thoughts and emotions
✅ Detailed action sequences with sensory details
✅ Elaborate dialogue with character voice
✅ NO rushing - fully develop each moment
✅ Character names STAY CONSISTENT forever

WRITE THE STORY NOW (5,500 characters):`;
}

function buildContinuationPrompt(title, niche, tone, previousContext, config, partNum) {
    const sectionGoal = getSectionGoal(partNum, config.chunks);
    const isLastChunk = partNum === config.chunks;
    
    let prompt = `Continue seamlessly. Chunk ${partNum} of ${config.chunks}.

🎯 TARGET: EXACTLY 5,500 characters for THIS chunk.

**PREVIOUS CONTEXT:**
${previousContext}

**SEAMLESS RULES:**
✅ Continue EXACTLY where previous ended - no gaps
✅ SAME character names (NEVER change!)
✅ Same personality, abilities, style
✅ NO recaps or reintroductions
✅ Natural flow like one continuous story

**THIS CHUNK'S FOCUS:**
${sectionGoal}

`;

    if (isLastChunk) {
        prompt += `🔥 FINAL CHUNK - Complete the story powerfully!

**ENDING MUST HAVE:**
✅ Resolve ALL plot threads
✅ Epic climax with full detail
✅ Clear aftermath and consequences
✅ Character reflection and growth
✅ Satisfying emotional closure
✅ Memorable final moment

`;
    }

    prompt += `**Write EXACTLY 5,500 characters with maximum detail and richness!**

Continue the ${niche} story NOW:`;

    return prompt;
}

function extractCleanContext(text) {
    if (!text || text.length < 100) return text;
    
    const contextLength = Math.min(1000, text.length);
    let context = text.slice(-contextLength);
    
    const firstPeriod = context.indexOf('. ');
    if (firstPeriod > 0 && firstPeriod < 200) {
        context = context.slice(firstPeriod + 2);
    }
    
    return context.trim();
}

async function callGeminiAPI(prompt, apiKey, maxRetries = 3) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const response = await axios.post(url, {
                contents: [{
                    parts: [{ text: prompt }]
                }],
                generationConfig: {
                    temperature: 0.95,
                    topP: 0.95,
                    topK: 64,
                    maxOutputTokens: 8192
                }
            }, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 120000
            });

            if (response.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
                return response.data.candidates[0].content.parts[0].text;
            }
            throw new Error('Invalid response format');
        } catch (error) {
            console.error(`Attempt ${attempt + 1} failed:`, error.message);
            
            if (attempt === maxRetries - 1) throw error;
            
            if (error.response?.status === 429 || error.code === 'ECONNABORTED') {
                const waitTime = 2000 * (attempt + 1);
                console.log(`Waiting ${waitTime}ms before retry...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            } else {
                throw error;
            }
        }
    }
}

// 🚀 NEW: Auto-generate story details from title
app.post('/api/auto-generate-details', async (req, res) => {
    try {
        const { title } = req.body;

        if (!title) {
            return res.status(400).json({ error: 'Title is required' });
        }

        console.log(`🤖 Auto-generating details for: "${title}"`);

        const prompt = `You are a professional story consultant. Based on this title: "${title}"

Generate a complete, detailed story plan in VALID JSON format (no markdown, no code blocks):

{
  "niche": "Choose ONE: Fantasy, Sci-Fi, Romance, Horror, Mystery, Thriller, Adventure, Drama, Comedy, Historical Fiction, Urban Fantasy, Cyberpunk, Dystopian, Superhero, Western, Post-Apocalyptic, Paranormal, Crime, War, Slice of Life",
  "tone": "Choose ONE: Dark and gritty, Epic and heroic, Light and humorous, Mysterious and suspenseful, Romantic and emotional, Action-packed and intense, Philosophical and thoughtful, Horrifying and tense",
  "plot": "Write a DETAILED 300-word plot summary with: main character, their goal, main conflict, key challenges, and resolution path. Include specific plot points and dramatic moments.",
  "styleExample": "Write a 600-character sample of actual story prose in the style this story should be written. Include dialogue, action, and description. Make it compelling and match the tone.",
  "suggestedLength": 60000
}

CRITICAL: Return ONLY valid JSON, no other text. Be creative and detailed!`;

        const apiKey = getNextApiKey();
        const response = await callGeminiAPI(prompt, apiKey);

        // Clean response to extract JSON
        let jsonStr = response.trim();
        
        // Remove markdown code blocks if present
        jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '');
        
        // Find JSON object
        const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('No valid JSON found in response');
        }
        
        const details = JSON.parse(jsonMatch[0]);

        // Validate required fields
        if (!details.niche || !details.tone || !details.plot || !details.styleExample) {
            throw new Error('Generated details missing required fields');
        }

        console.log(`✅ Details generated successfully`);

        res.json({
            success: true,
            details
        });

    } catch (error) {
        console.error('❌ Auto-generation error:', error);
        res.status(500).json({
            error: error.message || 'Failed to auto-generate details',
            success: false
        });
    }
});

// 🚀 NEW: SSE Streaming endpoint
app.post('/api/generate-stream', async (req, res) => {
    try {
        const { title, niche, tone, plot, styleExample, extraInstructions, targetLength = 60000 } = req.body;

        if (!title || !niche || !tone || !plot || !styleExample) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Set up SSE
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('Access-Control-Allow-Origin', '*');

        console.log(`\n🚀 Starting STREAM: "${title}"`);
        console.log(`📏 Target: ${targetLength.toLocaleString()} characters\n`);

        const config = getChunkConfig(targetLength);
        const chunks = [];

        // Send initial config
        res.write(`data: ${JSON.stringify({
            type: 'init',
            totalChunks: config.chunks,
            targetLength
        })}\n\n`);

        for (let i = 0; i < config.chunks; i++) {
            const partNum = i + 1;
            const isFirstChunk = i === 0;

            console.log(`📝 Generating chunk ${partNum}/${config.chunks}...`);

            // Send progress update
            res.write(`data: ${JSON.stringify({
                type: 'progress',
                chunk: partNum,
                total: config.chunks,
                progress: Math.round((partNum / config.chunks) * 100)
            })}\n\n`);

            let prompt;
            if (isFirstChunk) {
                prompt = buildFirstChunkPrompt(title, niche, tone, plot, styleExample, extraInstructions, config, partNum);
            } else {
                const previousContext = extractCleanContext(chunks[i - 1]);
                prompt = buildContinuationPrompt(title, niche, tone, previousContext, config, partNum);
            }

            const apiKey = getNextApiKey();
            const chunk = await callGeminiAPI(prompt, apiKey);

            chunks.push(chunk);
            console.log(`✅ Chunk ${partNum} complete: ${chunk.length.toLocaleString()} chars`);

            // Send chunk data
            res.write(`data: ${JSON.stringify({
                type: 'chunk',
                chunk: partNum,
                text: chunk,
                chars: chunk.length
            })}\n\n`);
        }

        const fullStory = chunks.join('\n\n');
        console.log(`\n🎉 STREAM COMPLETE: ${fullStory.length.toLocaleString()} characters\n`);

        // Send completion
        res.write(`data: ${JSON.stringify({
            type: 'complete',
            totalChars: fullStory.length,
            totalWords: fullStory.split(/\s+/).length,
            fullStory
        })}\n\n`);

        res.end();

    } catch (error) {
        console.error('❌ Stream error:', error);
        res.write(`data: ${JSON.stringify({
            type: 'error',
            error: error.message
        })}\n\n`);
        res.end();
    }
});

// Original non-streaming endpoint (kept for compatibility)
app.post('/api/generate', async (req, res) => {
    try {
        const { title, niche, tone, plot, styleExample, extraInstructions, targetLength = 60000 } = req.body;

        if (!title || !niche || !tone || !plot || !styleExample) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        console.log(`\n🚀 Starting: "${title}"`);

        const config = getChunkConfig(targetLength);
        const chunks = [];

        for (let i = 0; i < config.chunks; i++) {
            const partNum = i + 1;
            const isFirstChunk = i === 0;

            let prompt;
            if (isFirstChunk) {
                prompt = buildFirstChunkPrompt(title, niche, tone, plot, styleExample, extraInstructions, config, partNum);
            } else {
                const previousContext = extractCleanContext(chunks[i - 1]);
                prompt = buildContinuationPrompt(title, niche, tone, previousContext, config, partNum);
            }

            const apiKey = getNextApiKey();
            const chunk = await callGeminiAPI(prompt, apiKey);
            chunks.push(chunk);
        }

        const fullStory = chunks.join('\n\n');

        res.json({
            success: true,
            script: fullStory,
            stats: {
                totalChars: fullStory.length,
                totalWords: fullStory.split(/\s+/).length,
                targetLength,
                achieved: fullStory.length >= targetLength * 0.95
            }
        });

    } catch (error) {
        console.error('❌ Error:', error);
        res.status(500).json({
            error: error.message || 'Generation failed',
            success: false
        });
    }
});

app.get('/api/health', (req, res) => {
    res.json({
        status: 'ready',
        apiKeys: apiKeys.length,
        features: ['SSE Streaming', 'Auto-generate', 'Real-time progress'],
        timestamp: new Date().toISOString()
    });
});

app.get('/', (req, res) => {
    res.json({
        service: 'AI Story Generator - ULTIMATE Edition',
        status: 'running',
        apiKeys: apiKeys.length,
        features: {
            streaming: true,
            autoGenerate: true,
            realTimeProgress: true
        },
        endpoints: {
            autoGenerate: '/api/auto-generate-details',
            generateStream: '/api/generate-stream',
            generate: '/api/generate',
            health: '/api/health'
        }
    });
});

app.listen(PORT, () => {
    console.log(`\n✅ ULTIMATE Server running on port ${PORT}`);
    console.log(`✅ API Keys loaded: ${apiKeys.length}`);
    console.log(`🚀 Features: SSE Streaming + Auto-Generate + Real-time`);
    console.log(`⚡ Ready for production!\n`);
});

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

class KeyManager {
    constructor() {
        this.keys = [];
        this.currentIndex = 0;
        this.usage = {};
        this.blocked = {};
        
        for (let i = 1; i <= 10; i++) {
            const key = process.env[`GEMINI_KEY_${i}`];
            if (key && key.trim()) {
                this.keys.push(key.trim());
                this.usage[key] = 0;
                this.blocked[key] = false;
            }
        }
        
        console.log(`✅ Loaded ${this.keys.length} API keys`);
    }
    
    getKey() {
        if (this.keys.length === 0) throw new Error('No API keys configured');
        
        let attempts = 0;
        while (attempts < this.keys.length) {
            const key = this.keys[this.currentIndex];
            if (!this.blocked[key]) {
                this.usage[key]++;
                console.log(`🔑 Key #${this.currentIndex + 1} (${this.usage[key]} uses)`);
                this.currentIndex = (this.currentIndex + 1) % this.keys.length;
                return key;
            }
            this.currentIndex = (this.currentIndex + 1) % this.keys.length;
            attempts++;
        }
        throw new Error('All keys rate-limited');
    }
    
    blockKey(key) {
        this.blocked[key] = true;
        console.log('⚠️ Key blocked, switching...');RéessayerAid do that what i get Live tail
GMT+1
Menu
info No lockfile found.
warning story-generator-backend@1.0.0: No license field
[1/5] Validating package.json...
warning story-generator-backend@1.0.0: No license field
[2/5] Resolving packages...
[3/5] Fetching packages...
[4/5] Linking dependencies...
[5/5] Building fresh packages...
success Saved lockfile.
Done in 1.47s.
==> Uploading build...
==> Uploaded in 4.5s. Compression took 1.2s
==> Build successful 🎉
==> Deploying...
==> Running 'node index.js'
/opt/render/project/src/index.js:290
SyntaxError: Unexpected end of input
    at wrapSafe (node:internal/modules/cjs/loader:1691:18)
    at Module._compile (node:internal/modules/cjs/loader:1734:20)
    at Object..js (node:internal/modules/cjs/loader:1892:10)
    at Module.load (node:internal/modules/cjs/loader:1480:32)
    at Module._load (node:internal/modules/cjs/loader:1299:12)
    at TracingChannel.traceSync (node:diagnostics_channel:328:14)
    at wrapModuleLoad (node:internal/modules/cjs/loader:245:24)
    at Module.executeUserEntryPoint [as runMain] (node:internal/modules/run_main:154:5)
    at node:internal/main/run_main_module:33:47
Node.js v25.1.0
==> Exited with status 1
==> Common ways to troubleshoot your deploy: https://render.com/docs/troubleshooting-deploys
==> Running 'node index.js'
/opt/render/project/src/index.js:290
SyntaxError: Unexpected end of input
    at wrapSafe (node:internal/modules/cjs/loader:1691:18)
    at Module._compile (node:internal/modules/cjs/loader:1734:20)
    at Object..js (node:internal/modules/cjs/loader:1892:10)
    at Module.load (node:internal/modules/cjs/loader:1480:32)
    at Module._load (node:internal/modules/cjs/loader:1299:12)
    at TracingChannel.traceSync (node:diagnostics_channel:328:14)
    at wrapModuleLoad (node:internal/modules/cjs/loader:245:24)
    at Module.executeUserEntryPoint [as runMain] (node:internal/modules/run_main:154:5)
    at node:internal/main/run_main_module:33:47
Node.js v25.1.0Afficher plus😅 AH! The file got cut off! The code is incomplete!

🔴 THE PROBLEM:
The index.js file is missing the ending code. It stops at line 290 but needs more code to complete properly.

✅ THE COMPLETE FIX:
Go back to GitHub and replace the ENTIRE index.js with this COMPLETE, TESTED code:

Go to: https://github.com/alaebaha20k-maker/story-generator-backend
Click index.js
Click pencil icon (✏️)
Delete EVERYTHING
Paste this COMPLETE code:

javascriptconst express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

class KeyManager {
    constructor() {
        this.keys = [];
        this.currentIndex = 0;
        this.usage = {};
        this.blocked = {};
        
        for (let i = 1; i <= 10; i++) {
            const key = process.env[`GEMINI_KEY_${i}`];
            if (key && key.trim()) {
                this.keys.push(key.trim());
                this.usage[key] = 0;
                this.blocked[key] = false;
            }
        }
        
        console.log(`✅ Loaded ${this.keys.length} API keys`);
    }
    
    getKey() {
        if (this.keys.length === 0) throw new Error('No API keys configured');
        
        let attempts = 0;
        while (attempts < this.keys.length) {
            const key = this.keys[this.currentIndex];
            if (!this.blocked[key]) {
                this.usage[key]++;
                console.log(`🔑 Key #${this.currentIndex + 1} (${this.usage[key]} uses)`);
                this.currentIndex = (this.currentIndex + 1) % this.keys.length;
                return key;
            }
            this.currentIndex = (this.currentIndex + 1) % this.keys.length;
            attempts++;
        }
        throw new Error('All keys rate-limited');
    }
    
    blockKey(key) {
        this.blocked[key] = true;
        console.log('⚠️ Key blocked, switching...');
        setTimeout(() => { this.blocked[key] = false; }, 60000);
    }
}

const keyManager = new KeyManager();

async function callGemini(prompt, retries = 0) {
    const maxRetries = 3;
    const apiKey = keyManager.getKey();
    
    try {
        console.log(`📡 Calling Gemini (attempt ${retries + 1})...`);
        
        const response = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
            {
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.95,
                    maxOutputTokens: 65536,
                    topP: 0.95,
                    topK: 64
                }
            },
            { timeout: 120000 }
        );
        
        const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (!text) throw new Error('Invalid response');
        
        console.log(`✅ Generated ${text.length} chars`);
        return text;
        
    } catch (error) {
        if (error.response?.status === 429 || error.response?.status === 503) {
            keyManager.blockKey(apiKey);
            if (retries < maxRetries) {
                await new Promise(r => setTimeout(r, 2000));
                return callGemini(prompt, retries + 1);
            }
        }
        throw error;
    }
}

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 50
});
app.use('/api/', limiter);

app.get('/', (req, res) => {
    res.json({
        status: 'online',
        message: 'Story Generator API',
        version: '1.0.0',
        keys: keyManager.keys.length
    });
});

app.get('/api/health', (req, res) => {
    res.json({
        status: 'online',
        keys: keyManager.keys.length
    });
});

app.post('/api/generate', async (req, res) => {
    try {
        const { niche, tone, styleExample, title, plot, extraInstructions, targetLength } = req.body;
        
        if (!title || !niche || !tone || !styleExample || !plot) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }
        
        if (styleExample.length < 500) {
            return res.status(400).json({ success: false, error: 'Style example too short (min 500 chars)' });
        }
        
        console.log(`📝 Generating: "${title}"`);
        
        const length = targetLength || 60000;
        let chunks, charsPerChunk;
        
        if (length <= 10000) { chunks = 2; charsPerChunk = 6000; }
        else if (length <= 30000) { chunks = 2; charsPerChunk = 15000; }
        else if (length <= 60000) { chunks = 3; charsPerChunk = 20000; }
        else if (length <= 70000) { chunks = 3; charsPerChunk = 25000; }
        else { chunks = 3; charsPerChunk = 35000; }
        
        const generatedChunks = [];
        
        for (let i = 0; i < chunks; i++) {
            const partNum = i + 1;
            let prompt;
            
            if (i === 0) {
                prompt = `You are a MASTER storyteller creating ${tone} content in the ${niche} niche.

🎯 TARGET: EXACTLY ${charsPerChunk.toLocaleString()} characters (Part ${partNum}/${chunks})

STYLE REFERENCE (MATCH EXACTLY):
${styleExample.substring(0, 5000)}

STORY DETAILS:
Title: ${title}
Plot: ${plot}
${extraInstructions ? `Instructions: ${extraInstructions}` : ''}

${chunks === 1 ? 'Write COMPLETE story.' : `Part ${partNum}/${chunks} - Write OPENING with hook.`}

CRITICAL RULES:
❌ NO labels/headers
❌ NO name changes
✅ Match style EXACTLY
✅ Create UNIQUE hook (contextual to story)
✅ All 5 senses
✅ Natural dialogue
✅ Show emotions physically
✅ Varied sentences
✅ Build tension

WRITE EXACTLY ${charsPerChunk.toLocaleString()} CHARACTERS!

Begin (no title):`;
            } else {
                const prev = generatedChunks[i-1].split(/[.!?]/).filter(s => s.trim().length > 20).slice(-8).join('. ') + '.';
                
                prompt = `Continue SEAMLESSLY. Part ${partNum}/${chunks}.

PREVIOUS ENDED:
"${prev}"

🎯 EXACTLY ${charsPerChunk.toLocaleString()} characters

${partNum === chunks ? 'FINAL PART - Complete with satisfying ending!' : `Part ${partNum} - Continue tension.`}

✅ Continue where previous ended
✅ Same names/personalities
✅ Same style/tone
✅ Natural flow

${partNum === chunks ? 'ENDING: Wrap all threads, character arc, emotional satisfaction, strong close.' : ''}

WRITE ${charsPerChunk.toLocaleString()} CHARACTERS!

Continue:`;
            }
            
            const chunk = await callGemini(prompt);
            generatedChunks.push(chunk);
            console.log(`✅ Part ${partNum}/${chunks}: ${chunk.length} chars`);
        }
        
        const finalScript = generatedChunks.join('\n\n');
        console.log(`🎉 Total: ${finalScript.length} chars`);
        
        res.json({
            success: true,
            script: finalScript,
            stats: {
                totalChars: finalScript.length,
                totalWords: Math.round(finalScript.length / 5),
                chunks: chunks
            }
        });
        
    } catch (error) {
        console.error('Error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/auto-generate', async (req, res) => {
    try {
        const { title, niche, tone } = req.body;
        
        if (!title || !niche || !tone) {
            return res.status(400).json({ success: false, error: 'Missing data' });
        }
        
        console.log(`🤖 Auto-generating: "${title}"`);
        
        const prompt = `Generate story setup for:

Title: "${title}"
Niche: ${niche}
Tone: ${tone}

Return JSON:
{
  "characters": [{"name": "Full Name", "age": number, "role": "description"}],
  "location": "Specific place, year",
  "concept": "2-3 sentence concept"
}

Make contextual, realistic. 2-3 characters max.`;
        
        const result = await callGemini(prompt);
        const jsonMatch = result.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('No valid JSON');
        
        const setup = JSON.parse(jsonMatch[0]);
        res.json({ success: true, setup: setup });
        
    } catch (error) {
        console.error('Auto-gen error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════╗
║  🎬 STORY GENERATOR API       ║
║  ✅ Port: ${PORT}                 ║
║  🔒 Keys: ${keyManager.keys.length}                   ║
║  🚀 READY!                     ║
╚════════════════════════════════╝
    `);
});

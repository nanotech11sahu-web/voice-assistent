// Node 18 has no global WebCrypto; msedge-tts needs it.
import { webcrypto } from 'crypto';
if (!(globalThis as any).crypto) (globalThis as any).crypto = webcrypto;
import 'reflect-metadata';
import { Module, Controller, Get, Post, Req, Query } from '@nestjs/common';
import OpenAI, { toFile } from 'openai';
import { NestFactory } from '@nestjs/core';
import mongoose from 'mongoose';
import { cfg } from './config';
import { CallLog, Lead } from './models';
import { attachCallServer } from './call.server';

const stt = new OpenAI({ apiKey: cfg.grokKey || 'missing', baseURL: process.env.LLM_BASE_URL || 'https://api.x.ai/v1' });
const JUNK = /^(thank you\.?|thanks\.?|thanks for watching\.?|thank you for watching\.?|you\.?|bye\.?|\.+)$/i;
@Controller()
class ApiController {
  @Post('transcribe') async transcribe(@Req() req: any, @Query('lang') lang: string) {
    const buf: Buffer = req.body; if (!Buffer.isBuffer(buf) || buf.length < 2000) return { text: '' };
    try {
      const r: any = await stt.audio.transcriptions.create({ file: await toFile(buf, 'speech.wav', { type: 'audio/wav' }), model: process.env.STT_MODEL || 'whisper-large-v3-turbo',
        language: lang?.startsWith('hi') ? 'hi' : 'en', temperature: 0,
        prompt: 'A phone call about building a website for a small business in India. Words: Nayandeep, website, shop, Betul, Instagram, WhatsApp, PMC Yellow Pages, logo, domain.' });
      const text = String(r.text || '').trim(); return { text: JUNK.test(text) ? '' : text };
    } catch (e: any) { console.error('stt failed:', e?.message); return { text: '' }; }
  }
  @Get('calls') async calls() { return CallLog.find().sort({ startedAt: -1 }).limit(100).populate('leadId', 'name phone businessName').lean(); }
  @Get('leads') async leads() { return Lead.find().sort({ updatedAt: -1 }).limit(100).lean(); }
}
@Module({ controllers: [ApiController] }) class AppModule {}

async function bootstrap() {
  if (!cfg.grokKey) console.warn('WARNING: GROK_API_KEY is not set');
  await mongoose.connect(cfg.mongo);
  const app = await NestFactory.create(AppModule);
  app.use('/api/transcribe', require('express').raw({ type: '*/*', limit: '15mb' })); app.enableCors(); app.setGlobalPrefix('api');
  await app.listen(cfg.port);
  attachCallServer(app.getHttpServer());
  console.log(`Backend on http://localhost:${cfg.port}  (ws path /ws, model ${cfg.model})`);
}
bootstrap();

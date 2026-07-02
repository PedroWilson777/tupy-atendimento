import axios from 'axios';

const BASE_URL = process.env.EVOLUTION_API_URL?.replace(/\/$/, '');
const API_KEY  = process.env.EVOLUTION_API_KEY;
const INSTANCE = process.env.EVOLUTION_INSTANCE;

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'apikey': API_KEY, 'Content-Type': 'application/json' },
  timeout: 15000,
});

export async function sendText(phone, text) {
  await api.post(`/message/sendText/${INSTANCE}`, { number: normalizePhone(phone), text });
}

export async function sendImage(phone, imageData, caption = '') {
  const number = normalizePhone(phone);
  const isBase64 = imageData.startsWith('data:') || (!imageData.startsWith('http') && imageData.length > 200);
  const media = imageData.startsWith('data:') ? imageData.split(',')[1] : imageData;
  await api.post(`/message/sendMedia/${INSTANCE}`, {
    number, mediatype: 'image', media, caption,
    ...(isBase64 ? { fileName: 'imagem.jpg' } : {}),
  });
}

export async function sendAudio(phone, base64Audio) {
  const number = normalizePhone(phone);
  const audio = base64Audio.includes(',') ? base64Audio.split(',')[1] : base64Audio;
  await api.post(`/message/sendWhatsAppAudio/${INSTANCE}`, { number, audio, encoding: true });
}

export async function checkInstance() {
  try {
    const { data } = await api.get(`/instance/connectionState/${INSTANCE}`);
    return data?.instance?.state === 'open';
  } catch { return false; }
}

function normalizePhone(phone) {
  // Evolution API v2.x aceita só dígitos ou formato com @s.whatsapp.net
  // Remove o sufixo se vier com @ e devolve só os dígitos
  return phone.replace('@s.whatsapp.net', '').replace('@g.us', '').replace(/\D/g, '');
}

export function extractPhone(remoteJid) {
  return remoteJid.replace('@s.whatsapp.net', '').replace('@g.us', '');
}

export function isGroup(remoteJid) {
  return remoteJid.endsWith('@g.us');
}

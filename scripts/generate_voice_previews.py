#!/usr/bin/env python3
"""
Script para gerar os 30 audios de preview das vozes do Gemini TTS
"""

import os
import sys
import json
import base64
import wave
import struct
import time
from google import genai

# API Key
API_KEY = "AIzaSyBLAqNLiVJZ2767R8ZFFi2ln7tqlMA_r1k"

# Pasta de saida
OUTPUT_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "assets", "voices")

# Vozes e frases
VOZES_FRASES = {
    # Vozes agudas (Higher pitch)
    "Zephyr": "Ola! Esta e a minha voz. Pronta para dar vida aos seus videos!",
    "Leda": "Bem-vindo ao seu proximo video viral. Vamos comecar!",
    "Laomedeia": "Ei, voce! Sim, voce mesmo! Preparado para criar algo incrivel?",
    "Achernar": "As vezes, uma boa historia comeca com uma simples ideia.",

    # Vozes medias (Middle pitch)
    "Puck": "E ai, tudo certo? Bora fazer um conteudo massa hoje!",
    "Kore": "Voce sabia que criar conteudo nunca foi tao facil? Deixa eu te mostrar.",
    "Aoede": "Relaxa e deixa comigo. Sua narracao esta em boas maos.",
    "Callirrhoe": "Nao precisa se preocupar, vou te ajudar a contar sua historia.",
    "Autonoe": "Cada video e uma nova oportunidade de se conectar com seu publico.",
    "Despina": "Se voce curtiu esse conteudo, nao esquece de deixar o like!",
    "Erinome": "Clareza e tudo. Vamos passar sua mensagem de forma objetiva.",
    "Rasalgethi": "Dados mostram que videos com boa narracao engajam tres vezes mais.",
    "Gacrux": "Com experiencia, aprendi que consistencia e a chave do sucesso.",
    "Pulcherrima": "Vamos direto ao ponto. Seu tempo e valioso.",
    "Vindemiatrix": "Conte sua historia com carinho. Seu publico vai sentir.",
    "Sadaltager": "Pesquisas indicam que este e o melhor momento para criar conteudo.",
    "Sulafat": "Sinta-se em casa. Estamos aqui para construir algo juntos.",

    # Vozes medio-graves (Lower middle pitch)
    "Fenrir": "Uau! Voce nao vai acreditar no que vem por ai!",
    "Orus": "Preste atencao. O que vou te contar pode mudar tudo.",
    "Iapetus": "Passo a passo, vou te guiar nessa jornada.",
    "Umbriel": "Fica tranquilo, nao tem misterio. E mais simples do que parece.",
    "Alnilam": "Foco e determinacao. Esses sao os ingredientes do sucesso.",
    "Schedar": "Mantenha a calma e siga em frente. Um passo de cada vez.",
    "Achird": "E ai, parceiro! Pronto para mais uma aventura?",
    "Zubenelgenubi": "Relaxa ai que o conteudo de hoje ta show de bola.",

    # Vozes graves (Lower pitch)
    "Charon": "Estudos comprovam: quem assiste ate o final aprende mais.",
    "Enceladus": "Feche os olhos e imagine... agora abra e veja a realidade.",
    "Algieba": "Com calma e precisao, vamos construir algo memoravel.",
    "Algenib": "Nao existe atalho para a grandeza. Vamos pelo caminho certo.",
    "Sadachbia": "Energia e tudo! Vamos transformar ideias em realidade!",
}

def generate_voice_preview(client, voice_name, text, output_path):
    """Gera um audio de preview para uma voz"""
    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash-preview-tts",
            contents=text,
            config=genai.types.GenerateContentConfig(
                response_modalities=["AUDIO"],
                speech_config=genai.types.SpeechConfig(
                    voice_config=genai.types.VoiceConfig(
                        prebuilt_voice_config=genai.types.PrebuiltVoiceConfig(
                            voice_name=voice_name
                        )
                    )
                )
            )
        )

        # Extrair audio
        audio_data = response.candidates[0].content.parts[0].inline_data.data

        # Salvar como WAV
        audio_bytes = base64.b64decode(audio_data) if isinstance(audio_data, str) else audio_data

        with open(output_path, "wb") as f:
            f.write(audio_bytes)

        return True
    except Exception as e:
        print(f"  ERRO: {e}")
        return False

def main():
    # Criar pasta de saida
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # Inicializar cliente
    client = genai.Client(api_key=API_KEY)

    print(f"Gerando {len(VOZES_FRASES)} audios de preview...")
    print(f"Pasta de saida: {OUTPUT_DIR}")
    print("-" * 50)

    success = 0
    failed = 0

    for voice_name, text in VOZES_FRASES.items():
        output_path = os.path.join(OUTPUT_DIR, f"{voice_name.lower()}.wav")

        # Pular se ja existe
        if os.path.exists(output_path) and os.path.getsize(output_path) > 1000:
            print(f"[{success + failed + 1}/{len(VOZES_FRASES)}] {voice_name}... JA EXISTE")
            success += 1
            continue

        print(f"[{success + failed + 1}/{len(VOZES_FRASES)}] {voice_name}...", end=" ")

        if generate_voice_preview(client, voice_name, text, output_path):
            print("OK")
            success += 1
        else:
            failed += 1

        # Delay para evitar rate limit (10 req/min = 6 segundos entre cada)
        time.sleep(7)

    print("-" * 50)
    print(f"Concluido! {success} gerados, {failed} falharam")

if __name__ == "__main__":
    main()

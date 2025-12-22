#!/usr/bin/env python3
"""
Script para converter os arquivos de audio do Gemini TTS para formato WAV valido
O Gemini retorna audio em formato PCM linear 24kHz 16-bit mono
"""

import os
import wave
import struct

# Pasta dos audios
VOICES_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "assets", "voices")

# Parametros do audio do Gemini TTS
SAMPLE_RATE = 24000  # 24kHz
CHANNELS = 1  # Mono
SAMPLE_WIDTH = 2  # 16-bit = 2 bytes

def fix_wav_file(input_path, output_path):
    """Converte arquivo raw PCM para WAV valido"""
    try:
        # Ler dados raw
        with open(input_path, 'rb') as f:
            raw_data = f.read()

        # Criar arquivo WAV com header correto
        with wave.open(output_path, 'wb') as wav:
            wav.setnchannels(CHANNELS)
            wav.setsampwidth(SAMPLE_WIDTH)
            wav.setframerate(SAMPLE_RATE)
            wav.writeframes(raw_data)

        return True
    except Exception as e:
        print(f"Erro: {e}")
        return False

def main():
    print(f"Corrigindo arquivos em: {VOICES_DIR}")
    print("-" * 50)

    files = [f for f in os.listdir(VOICES_DIR) if f.endswith('.wav')]

    for filename in files:
        input_path = os.path.join(VOICES_DIR, filename)
        temp_path = os.path.join(VOICES_DIR, f"temp_{filename}")

        print(f"Processando {filename}...", end=" ")

        # Verificar se ja tem header WAV valido
        with open(input_path, 'rb') as f:
            header = f.read(4)

        if header == b'RIFF':
            print("JA OK")
            continue

        # Converter
        if fix_wav_file(input_path, temp_path):
            os.remove(input_path)
            os.rename(temp_path, input_path)
            print("CONVERTIDO")
        else:
            if os.path.exists(temp_path):
                os.remove(temp_path)
            print("ERRO")

    print("-" * 50)
    print("Concluido!")

if __name__ == "__main__":
    main()

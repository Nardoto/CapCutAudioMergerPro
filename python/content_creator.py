#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Content Creator - Gerador de Conteudo com Google AI
Gera roteiro, imagens e audio usando Gemini API
"""

import json
import sys
import os
import base64
import wave
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed

# Configuracoes
# Todas as 30 vozes disponiveis no Gemini TTS
VOZES_GEMINI = {
    # Higher pitch
    "Zephyr": "Zephyr", "Leda": "Leda", "Laomedeia": "Laomedeia", "Achernar": "Achernar",
    # Middle pitch
    "Puck": "Puck", "Kore": "Kore", "Aoede": "Aoede", "Callirrhoe": "Callirrhoe",
    "Autonoe": "Autonoe", "Despina": "Despina", "Erinome": "Erinome", "Rasalgethi": "Rasalgethi",
    "Gacrux": "Gacrux", "Pulcherrima": "Pulcherrima", "Vindemiatrix": "Vindemiatrix",
    "Sadaltager": "Sadaltager", "Sulafat": "Sulafat",
    # Lower middle pitch
    "Fenrir": "Fenrir", "Orus": "Orus", "Iapetus": "Iapetus", "Umbriel": "Umbriel",
    "Alnilam": "Alnilam", "Schedar": "Schedar", "Achird": "Achird", "Zubenelgenubi": "Zubenelgenubi",
    # Lower pitch
    "Charon": "Charon", "Enceladus": "Enceladus", "Algieba": "Algieba",
    "Algenib": "Algenib", "Sadachbia": "Sadachbia",
}

IDIOMAS = {"Portugues": "pt-BR", "Ingles": "en-US", "Espanhol": "es-ES"}

ASPECTOS = {"16:9": "16:9", "9:16": "9:16", "1:1": "1:1", "4:3": "4:3", "3:4": "3:4"}

ESTILOS_IMAGEM = {
    "Fotografia Profissional": {
        "prefix": "A professional 4K HDR photo of",
        "suffix": "taken by a professional photographer, high quality, detailed, sharp focus"
    },
    "Fotografia Cinematica": {
        "prefix": "A cinematic photo of",
        "suffix": "movie still, dramatic lighting, film grain, golden hour"
    },
    "Arte Digital": {
        "prefix": "Digital art of",
        "suffix": "highly detailed, vibrant colors, professional digital illustration"
    },
    "Ilustracao": {
        "prefix": "An illustration of",
        "suffix": "detailed illustration, artistic style, beautiful composition"
    },
    "Pintura a Oleo": {
        "prefix": "An oil painting of",
        "suffix": "in the style of a masterpiece, rich colors, textured brushstrokes"
    },
    "Arte Conceitual": {
        "prefix": "Concept art of",
        "suffix": "trending on artstation, highly detailed, professional concept art"
    },
    "Minimalista": {
        "prefix": "A minimalist image of",
        "suffix": "clean design, simple composition, modern aesthetic"
    },
    "Retro/Vintage": {
        "prefix": "A vintage photo of",
        "suffix": "retro style, film photography, nostalgic mood, warm tones"
    },
    "Neon/Cyberpunk": {
        "prefix": "A cyberpunk style image of",
        "suffix": "neon lights, futuristic, vibrant colors, sci-fi atmosphere"
    },
    "Aquarela": {
        "prefix": "A watercolor painting of",
        "suffix": "soft colors, artistic watercolor style, delicate brushwork"
    },
    "3D Render": {
        "prefix": "A 3D render of",
        "suffix": "octane render, highly detailed, professional 3D art, realistic lighting"
    },
    "Anime/Manga": {
        "prefix": "Anime style art of",
        "suffix": "anime aesthetic, vibrant colors, detailed anime illustration"
    },
}


def update_progress(progress_file, progress, status, log_msg=None, project_path=None):
    """Atualiza arquivo de progresso para o frontend ler"""
    data = {"progress": progress, "status": status}
    if log_msg:
        data["log"] = log_msg
    if project_path:
        data["projectPath"] = project_path
    with open(progress_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False)


def generate_content(params):
    """Gera conteudo completo: roteiro, imagens e audio"""
    try:
        from google import genai
        from google.genai import types
    except ImportError:
        return {"success": False, "error": "google-genai not installed. Run: pip install google-genai"}

    # Extrair parametros
    api_key = params.get('apiKey')
    tema = params.get('tema')
    instrucoes = params.get('instrucoes', '')
    idioma = params.get('idioma', 'Portugues')
    voz = params.get('voz', 'Kore')
    estilo = params.get('estilo', 'Fotografia Profissional')
    aspecto = params.get('aspecto', '9:16')
    tamanho_roteiro = int(params.get('tamanhoRoteiro', 2000))
    qtd_imagens = int(params.get('qtdImagens', 5))
    pasta_saida = params.get('pastaSaida')
    progress_file = params.get('progressFile')
    gerar_imagens = params.get('gerarImagens', True)  # Por padrao gera imagens

    # Novos parametros para modo roteiro manual
    modo_roteiro = params.get('modoRoteiro', False)  # Se usuario colou o roteiro
    roteiro_chunks = params.get('roteiroChunks', [])  # Chunks ja divididos pelo frontend
    gerar_srt = params.get('gerarSRT', False)  # Se deve gerar arquivo SRT

    if not api_key:
        return {"success": False, "error": "API Key not provided"}
    if not pasta_saida:
        return {"success": False, "error": "Output folder not provided"}

    # Criar cliente
    client = genai.Client(api_key=api_key)

    # Contadores de uso da API
    api_usage = {
        "texto": 0,    # Chamadas de geracao de texto (gemini-2.0-flash)
        "imagens": 0,  # Chamadas de geracao de imagem (gemini-2.5-flash-preview-image)
        "tts": 0       # Chamadas de TTS (gemini-2.5-flash-preview-tts)
    }

    # Criar pasta do projeto com numero sequencial (001, 002, etc)
    existing_folders = [f for f in os.listdir(pasta_saida) if os.path.isdir(os.path.join(pasta_saida, f)) and f.isdigit() and len(f) == 3]
    if existing_folders:
        next_num = max(int(f) for f in existing_folders) + 1
    else:
        next_num = 1
    projeto_pasta = os.path.join(pasta_saida, f"{next_num:03d}")
    os.makedirs(projeto_pasta, exist_ok=True)
    os.makedirs(os.path.join(projeto_pasta, "imagens"), exist_ok=True)

    # Iniciar documentacao do projeto
    projeto_doc = {
        "criado_em": datetime.now().isoformat(),
        "tema": tema,
        "instrucoes": instrucoes,
        "idioma": idioma,
        "voz": voz,
        "estilo": estilo,
        "aspecto": aspecto,
        "tamanho_roteiro": tamanho_roteiro,
        "qtd_imagens": qtd_imagens,
        "prompts_enviados": {},
        "respostas": {}
    }

    update_progress(progress_file, 5, "Iniciando...", f"Projeto: {projeto_pasta}", projeto_pasta)

    # ========== PASSO 1: GERAR/USAR ROTEIRO ==========
    if modo_roteiro and roteiro_chunks:
        # Modo roteiro manual - usar chunks fornecidos pelo usuario
        update_progress(progress_file, 10, "Usando roteiro fornecido...", project_path=projeto_pasta)

        roteiro_partes = roteiro_chunks
        roteiro = " ".join(roteiro_partes)

        # Atualizar documentacao
        projeto_doc["modo"] = "roteiro_manual"
        projeto_doc["prompts_enviados"]["roteiro"] = []
        projeto_doc["respostas"]["roteiro"] = {
            "texto_final": roteiro,
            "tamanho_chars": len(roteiro),
            "partes": len(roteiro_partes),
            "modo": "manual"
        }

        # Salvar roteiro
        with open(os.path.join(projeto_pasta, "roteiro.txt"), 'w', encoding='utf-8') as f:
            f.write(roteiro)

        # Salvar tambem cada parte separadamente para referencia
        for i, parte in enumerate(roteiro_partes):
            parte_path = os.path.join(projeto_pasta, f"parte_{i+1:02d}.txt")
            with open(parte_path, 'w', encoding='utf-8') as f:
                f.write(parte)

        update_progress(progress_file, 15, f"Roteiro: {len(roteiro_partes)} partes ({len(roteiro)} chars)", project_path=projeto_pasta)

    else:
        # Modo normal - IA gera roteiro
        update_progress(progress_file, 10, "Gerando roteiro...", project_path=projeto_pasta)

        CHUNK_SIZE = 5000
        num_partes = max(1, (tamanho_roteiro + CHUNK_SIZE - 1) // CHUNK_SIZE)
        chars_por_parte = tamanho_roteiro // num_partes

        roteiro_partes = []
        prompts_roteiro = []

        for parte_num in range(num_partes):
            is_primeira = parte_num == 0
            is_ultima = parte_num == num_partes - 1

            contexto_anterior = ""
            if roteiro_partes:
                contexto_anterior = " ".join(roteiro_partes)[-500:]

            # Instrucoes por posicao
            if is_primeira and is_ultima:
                pos_pt = "Comece de forma impactante e termine com call-to-action"
                pos_en = "Start with an impactful hook and end with a call-to-action"
                pos_es = "Comienza de forma impactante y termina con call-to-action"
            elif is_primeira:
                pos_pt = "Comece de forma impactante. NAO conclua ainda."
                pos_en = "Start with an impactful hook. DO NOT conclude yet."
                pos_es = "Comienza de forma impactante. NO concluyas aun."
            elif is_ultima:
                pos_pt = "Continue e termine com call-to-action forte"
                pos_en = "Continue and end with a strong call-to-action"
                pos_es = "Continua y termina con un call-to-action fuerte"
            else:
                pos_pt = "Continue desenvolvendo. NAO conclua ainda."
                pos_en = "Continue developing. DO NOT conclude yet."
                pos_es = "Continua desarrollando. NO concluyas aun."

            if idioma == "Ingles":
                prompt = f"""Write a narration script for a video about: {tema}
LENGTH: ~{chars_por_parte} characters. Part {parte_num + 1}/{num_partes}.
{f'Instructions: {instrucoes}' if instrucoes else ''}
{f'PREVIOUS CONTEXT: ...{contexto_anterior}' if contexto_anterior else ''}
RULES: Write ONLY spoken text. NO visual instructions or timestamps. {pos_en}
Return ONLY narration text in English."""
            elif idioma == "Espanhol":
                prompt = f"""Escribe narracion para video sobre: {tema}
LONGITUD: ~{chars_por_parte} chars. Parte {parte_num + 1}/{num_partes}.
{f'Instrucciones: {instrucoes}' if instrucoes else ''}
{f'CONTEXTO: ...{contexto_anterior}' if contexto_anterior else ''}
REGLAS: Solo texto hablado. SIN instrucciones visuales. {pos_es}
Devuelve SOLO narracion en espanol."""
            else:
                prompt = f"""Escreva narracao para video sobre: {tema}
TAMANHO: ~{chars_por_parte} chars. Parte {parte_num + 1}/{num_partes}.
{f'Instrucoes: {instrucoes}' if instrucoes else ''}
{f'CONTEXTO: ...{contexto_anterior}' if contexto_anterior else ''}
REGRAS: So texto falado. SEM instrucoes visuais. {pos_pt}
Retorne APENAS narracao em portugues."""

            # Salvar prompt na documentacao
            prompts_roteiro.append({
                "parte": parte_num + 1,
                "prompt": prompt
            })

            response = client.models.generate_content(model="gemini-2.0-flash", contents=prompt)
            api_usage["texto"] += 1
            roteiro_partes.append(response.text.strip())

            # Salvar resposta na documentacao
            prompts_roteiro[-1]["resposta"] = response.text.strip()

            if num_partes > 1:
                update_progress(progress_file, 10 + (10 * (parte_num + 1) / num_partes),
                              f"Roteiro: parte {parte_num + 1}/{num_partes}", project_path=projeto_pasta)

        roteiro = " ".join(roteiro_partes)

        # Salvar roteiro
        with open(os.path.join(projeto_pasta, "roteiro.txt"), 'w', encoding='utf-8') as f:
            f.write(roteiro)

        # Atualizar documentacao
        projeto_doc["modo"] = "ia_gera_roteiro"
        projeto_doc["prompts_enviados"]["roteiro"] = prompts_roteiro
        projeto_doc["respostas"]["roteiro"] = {
            "texto_final": roteiro,
            "tamanho_chars": len(roteiro),
            "partes": len(roteiro_partes)
        }

    update_progress(progress_file, 20, f"Roteiro pronto: {len(roteiro)} chars", project_path=projeto_pasta)

    # ========== PASSO 2: GERAR PROMPTS DE IMAGENS ==========
    if gerar_imagens:
        update_progress(progress_file, 25, f"Gerando {qtd_imagens} imagens...", project_path=projeto_pasta)
    else:
        update_progress(progress_file, 25, f"Gerando prompts para {qtd_imagens} imagens...", project_path=projeto_pasta)

    estilo_config = ESTILOS_IMAGEM.get(estilo, ESTILOS_IMAGEM["Fotografia Profissional"])
    style_prefix = estilo_config["prefix"]
    style_suffix = estilo_config["suffix"]

    # Gerar prompts
    prompt_prompts = f"""Create {qtd_imagens} SHORT image prompts in ENGLISH about: {tema}
Each: 10-20 words, different scenes, NO text in images, NO style instructions.
Return ONLY prompts, one per line."""

    # Documentar prompt de geracao de prompts
    projeto_doc["prompts_enviados"]["imagens_meta"] = prompt_prompts

    response = client.models.generate_content(model="gemini-2.0-flash", contents=prompt_prompts)
    api_usage["texto"] += 1
    prompts_lista = [p.strip().strip('"').strip("'") for p in response.text.strip().split('\n')
                    if p.strip() and len(p.strip()) > 10][:qtd_imagens]

    while len(prompts_lista) < qtd_imagens:
        prompts_lista.append(tema)

    # Funcao para limpar nome de arquivo
    def limpar_nome_arquivo(texto, max_chars=50):
        """Remove caracteres invalidos e limita tamanho"""
        # Caracteres invalidos para nomes de arquivo
        chars_invalidos = ['<', '>', ':', '"', '/', '\\', '|', '?', '*', '\n', '\r']
        nome = texto
        for char in chars_invalidos:
            nome = nome.replace(char, '')
        # Limitar tamanho e remover espacos extras
        nome = ' '.join(nome.split())[:max_chars].strip()
        # Substituir espacos por underscores
        nome = nome.replace(' ', '_')
        return nome

    # Documentar e salvar prompts das imagens (SEMPRE salva, mesmo sem gerar imagens)
    projeto_doc["prompts_enviados"]["imagens"] = []
    prompts_salvos = []

    for index, prompt in enumerate(prompts_lista):
        full_prompt = f"{style_prefix} {prompt}, {style_suffix}"
        # Usar nome curto para evitar problemas com limite de 260 caracteres do Windows
        nome_arquivo = f"TAKE_{index+1:02d}.png"

        prompt_info = {
            "index": index + 1,
            "prompt_base": prompt,
            "prompt_completo": full_prompt,
            "estilo": estilo,
            "nome_arquivo": nome_arquivo
        }
        projeto_doc["prompts_enviados"]["imagens"].append(prompt_info)
        prompts_salvos.append(prompt_info)

    # Salvar arquivo de prompts para uso posterior
    with open(os.path.join(projeto_pasta, "prompts_imagens.json"), 'w', encoding='utf-8') as f:
        json.dump(prompts_salvos, f, ensure_ascii=False, indent=2)

    # Salvar prompts em formato texto tambem
    with open(os.path.join(projeto_pasta, "prompts_imagens.txt"), 'w', encoding='utf-8') as f:
        for p in prompts_salvos:
            f.write(f"[{p['index']:02d}] {p['nome_arquivo']}\n")
            f.write(f"Prompt: {p['prompt_completo']}\n\n")

    imagens_geradas = 0

    # So gera imagens se gerar_imagens for True
    if gerar_imagens:
        def gerar_imagem(prompt_info):
            nonlocal imagens_geradas
            try:
                full_prompt = prompt_info["prompt_completo"]
                nome_arquivo = prompt_info["nome_arquivo"]

                # Usar Gemini 2.5 Flash Image (modelo correto para geracao de imagens)
                img_response = client.models.generate_content(
                    model="gemini-2.5-flash-image",
                    contents=f"Generate an image: {full_prompt}",
                    config=types.GenerateContentConfig(
                        response_modalities=["TEXT", "IMAGE"],
                        image_config=types.ImageConfig(aspect_ratio=aspecto)
                    )
                )
                api_usage["imagens"] += 1
                for part in img_response.candidates[0].content.parts:
                    if hasattr(part, 'inline_data') and part.inline_data:
                        img_data = part.inline_data.data
                        if isinstance(img_data, str):
                            img_data = base64.b64decode(img_data)
                        img_path = os.path.join(projeto_pasta, "imagens", nome_arquivo)
                        with open(img_path, 'wb') as f:
                            f.write(img_data)
                        return True
                print(f"[IMG-ERROR] {nome_arquivo}: No image data in response", file=sys.stderr)
                return False
            except Exception as e:
                print(f"[IMG-ERROR] {nome_arquivo}: {str(e)}", file=sys.stderr)
                return False

        # Processar em lotes de 5
        for i in range(0, len(prompts_salvos), 5):
            lote = prompts_salvos[i:i+5]
            with ThreadPoolExecutor(max_workers=5) as executor:
                futures = {executor.submit(gerar_imagem, p): j for j, p in enumerate(lote)}
                for future in as_completed(futures):
                    if future.result():
                        imagens_geradas += 1
            prog = 25 + (45 * min(i + 5, qtd_imagens) / qtd_imagens)
            update_progress(progress_file, prog, f"Imagens: {imagens_geradas}/{qtd_imagens}", project_path=projeto_pasta)
    else:
        # Pular geracao de imagens
        update_progress(progress_file, 70, f"Prompts salvos: {len(prompts_salvos)} (imagens nao geradas)", project_path=projeto_pasta)

    update_progress(progress_file, 70, "Gerando audio...", project_path=projeto_pasta)

    # ========== PASSO 3: GERAR AUDIO ==========
    voz_id = VOZES_GEMINI.get(voz, "Kore")

    # Criar pasta de audios
    audios_pasta = os.path.join(projeto_pasta, "audios")
    os.makedirs(audios_pasta, exist_ok=True)

    # No modo roteiro manual, usar as partes fornecidas diretamente
    # No modo IA, dividir em chunks de 2000 chars respeitando pontuacao
    if modo_roteiro and roteiro_chunks:
        # Usar as partes do roteiro manual diretamente para o TTS
        chunks = roteiro_partes
    else:
        # Modo IA - dividir o roteiro gerado em chunks para TTS
        chunks = []
        texto_restante = roteiro
        while texto_restante:
            if len(texto_restante) <= 2000:
                chunks.append(texto_restante)
                break
            ponto_corte = 2000
            for i in range(2000, max(1500, 0), -1):
                if texto_restante[i] in '.!?\n':
                    ponto_corte = i + 1
                    break
            chunks.append(texto_restante[:ponto_corte])
            texto_restante = texto_restante[ponto_corte:].strip()

    # Salvar os textos de cada chunk para referencia
    chunks_info = []
    for i, chunk in enumerate(chunks):
        chunk_info = {
            "index": i + 1,
            "text": chunk,
            "chars": len(chunk),
            "status": "pending"
        }
        chunks_info.append(chunk_info)

    # Salvar info dos chunks
    with open(os.path.join(projeto_pasta, "audio_chunks.json"), 'w', encoding='utf-8') as f:
        json.dump(chunks_info, f, ensure_ascii=False, indent=2)

    def gerar_audio_chunk(texto, index):
        try:
            tts_response = client.models.generate_content(
                model="gemini-2.5-flash-preview-tts",
                contents=texto,
                config=types.GenerateContentConfig(
                    response_modalities=["AUDIO"],
                    speech_config=types.SpeechConfig(
                        voice_config=types.VoiceConfig(
                            prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=voz_id)
                        )
                    )
                )
            )
            api_usage["tts"] += 1
            for part in tts_response.candidates[0].content.parts:
                if hasattr(part, 'inline_data') and part.inline_data:
                    raw_data = part.inline_data.data
                    if isinstance(raw_data, bytes):
                        return (index, raw_data, None)
                    return (index, base64.b64decode(raw_data), None)
            return (index, None, "Sem dados de audio na resposta")
        except Exception as e:
            return (index, None, str(e))

    audio_chunks = [None] * len(chunks)
    audio_errors = {}

    with ThreadPoolExecutor(max_workers=3) as executor:
        futures = {executor.submit(gerar_audio_chunk, c, i): i for i, c in enumerate(chunks)}
        for future in as_completed(futures):
            idx, data, error = future.result()

            if data:
                audio_chunks[idx] = data
                chunks_info[idx]["status"] = "ok"

                # Salvar cada parte separadamente
                parte_path = os.path.join(audios_pasta, f"parte_{idx+1:02d}.wav")
                with wave.open(parte_path, 'wb') as wav:
                    wav.setnchannels(1)
                    wav.setsampwidth(2)
                    wav.setframerate(24000)
                    wav.writeframes(data)
            else:
                chunks_info[idx]["status"] = "error"
                chunks_info[idx]["error"] = error or "Erro desconhecido"
                audio_errors[idx + 1] = error or "Erro desconhecido"

            # Atualizar arquivo de chunks
            with open(os.path.join(projeto_pasta, "audio_chunks.json"), 'w', encoding='utf-8') as f:
                json.dump(chunks_info, f, ensure_ascii=False, indent=2)

            partes_ok = sum(1 for c in chunks_info if c["status"] == "ok")
            partes_erro = sum(1 for c in chunks_info if c["status"] == "error")
            status_msg = f"Audio: {partes_ok}/{len(chunks)}"
            if partes_erro > 0:
                status_msg += f" ({partes_erro} erro{'s' if partes_erro > 1 else ''})"

            prog = 70 + (25 * (partes_ok + partes_erro) / len(chunks))
            update_progress(progress_file, prog, status_msg, project_path=projeto_pasta)

    # Juntar apenas as partes que deram certo para o audio completo
    audios_validos = [a for a in audio_chunks if a]
    audio_ok = False
    audio_durations = []  # Duracao de cada parte em segundos

    if audios_validos:
        audio_final = b''.join(audios_validos)
        audio_path = os.path.join(projeto_pasta, "audio_completo.wav")
        with wave.open(audio_path, 'wb') as wav:
            wav.setnchannels(1)
            wav.setsampwidth(2)
            wav.setframerate(24000)
            wav.writeframes(audio_final)
        audio_ok = True

        # Calcular duracao de cada parte de audio
        for i, audio_data in enumerate(audio_chunks):
            if audio_data:
                # Calcular duracao: bytes / (sample_rate * sample_width * channels)
                # sample_rate=24000, sample_width=2, channels=1
                duracao = len(audio_data) / (24000 * 2 * 1)
                audio_durations.append(duracao)
            else:
                audio_durations.append(0)

    # ========== PASSO 4: GERAR SRT (se solicitado) ==========
    srt_generated = False
    if gerar_srt and audio_ok and audio_durations:
        update_progress(progress_file, 98, "Gerando arquivo SRT...", project_path=projeto_pasta)

        def format_srt_time(seconds):
            """Converte segundos para formato SRT: HH:MM:SS,mmm"""
            hours = int(seconds // 3600)
            minutes = int((seconds % 3600) // 60)
            secs = int(seconds % 60)
            millis = int((seconds % 1) * 1000)
            return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"

        srt_content = []
        current_time = 0.0

        for i, chunk_text in enumerate(chunks):
            if i < len(audio_durations) and audio_durations[i] > 0:
                start_time = current_time
                end_time = current_time + audio_durations[i]

                # Adicionar entrada SRT
                srt_content.append(f"{i + 1}")
                srt_content.append(f"{format_srt_time(start_time)} --> {format_srt_time(end_time)}")
                srt_content.append(chunk_text.strip())
                srt_content.append("")  # Linha em branco

                current_time = end_time

        # Salvar arquivo SRT
        srt_path = os.path.join(projeto_pasta, "legendas.srt")
        with open(srt_path, 'w', encoding='utf-8') as f:
            f.write("\n".join(srt_content))

        srt_generated = True

        # Atualizar documentacao
        projeto_doc["srt"] = {
            "gerado": True,
            "arquivo": srt_path,
            "total_legendas": len(chunks),
            "duracao_total": current_time
        }

    # Status final
    partes_ok = len(audios_validos)
    partes_erro = len(chunks) - partes_ok

    if partes_erro > 0:
        status_final = f"Concluido com {partes_erro} erro{'s' if partes_erro > 1 else ''} de audio"
    else:
        status_final = "Concluido!"

    update_progress(progress_file, 100, status_final, project_path=projeto_pasta)

    # Finalizar documentacao
    projeto_doc["respostas"]["imagens"] = {
        "total_solicitadas": qtd_imagens,
        "total_geradas": imagens_geradas
    }
    projeto_doc["respostas"]["audio"] = {
        "voz_usada": voz_id,
        "partes_total": len(chunks),
        "partes_ok": partes_ok,
        "partes_erro": partes_erro,
        "erros": audio_errors
    }
    projeto_doc["finalizado_em"] = datetime.now().isoformat()

    # Salvar arquivo de documentacao completa
    with open(os.path.join(projeto_pasta, "projeto_info.json"), 'w', encoding='utf-8') as f:
        json.dump(projeto_doc, f, ensure_ascii=False, indent=2)

    return {
        "success": True,
        "projectPath": projeto_pasta,
        "scriptLength": len(roteiro),
        "scriptParts": len(roteiro_partes),
        "modoRoteiro": modo_roteiro,
        "imagesGenerated": imagens_geradas,
        "imagesRequested": qtd_imagens,
        "imagesSkipped": not gerar_imagens,
        "promptsSaved": len(prompts_salvos),
        "audioGenerated": audio_ok,
        "audioPartsOk": partes_ok,
        "audioPartsTotal": len(chunks),
        "audioErrors": audio_errors,
        "chunksInfo": chunks_info,
        "srtGenerated": srt_generated,
        "apiUsage": api_usage
    }


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "No command provided"}))
        return

    try:
        # Pode receber JSON direto ou via arquivo
        arg = sys.argv[1]
        if arg.startswith('--file'):
            file_path = sys.argv[2] if len(sys.argv) > 2 else arg.split('=')[1]
            with open(file_path, 'r', encoding='utf-8') as f:
                command = json.load(f)
        else:
            command = json.loads(arg)

        action = command.get('action')

        if action == 'generate':
            result = generate_content(command)
        else:
            result = {"success": False, "error": f"Unknown action: {action}"}

        print(json.dumps(result, ensure_ascii=False))

    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))


if __name__ == "__main__":
    main()

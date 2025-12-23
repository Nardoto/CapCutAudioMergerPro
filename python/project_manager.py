#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Project Manager - Importar e Exportar projetos CapCut
Gerencia a exportacao com copia de midias e importacao de projetos zipados
"""

import json
import sys
import os
import shutil
import zipfile
from datetime import datetime
import uuid


def get_all_media_paths(draft_content):
    """Extrai todos os caminhos de midia do draft_content.json"""
    media_paths = []

    # Materials -> videos
    materials = draft_content.get("materials", {})
    for video in materials.get("videos", []):
        path = video.get("path", "")
        if path and os.path.exists(path):
            media_paths.append({
                "original_path": path,
                "type": "video",
                "id": video.get("id", "")
            })

    # Materials -> audios
    for audio in materials.get("audios", []):
        path = audio.get("path", "")
        if path and os.path.exists(path):
            media_paths.append({
                "original_path": path,
                "type": "audio",
                "id": audio.get("id", "")
            })

    # Materials -> images (se existir)
    for image in materials.get("images", []):
        path = image.get("path", "")
        if path and os.path.exists(path):
            media_paths.append({
                "original_path": path,
                "type": "image",
                "id": image.get("id", "")
            })

    return media_paths


def update_media_paths(draft_content, path_mapping):
    """Atualiza os caminhos das midias no draft_content para os novos caminhos"""
    materials = draft_content.get("materials", {})

    # Atualizar videos
    for video in materials.get("videos", []):
        original = video.get("path", "")
        if original in path_mapping:
            video["path"] = path_mapping[original]

    # Atualizar audios
    for audio in materials.get("audios", []):
        original = audio.get("path", "")
        if original in path_mapping:
            audio["path"] = path_mapping[original]

    # Atualizar images
    for image in materials.get("images", []):
        original = image.get("path", "")
        if original in path_mapping:
            image["path"] = path_mapping[original]

    return draft_content


def export_project(params):
    """
    Exporta um projeto CapCut para um arquivo ZIP
    - Copia todas as midias para dentro do projeto
    - Atualiza os caminhos no draft_content.json
    - Cria arquivo ZIP com tudo
    """
    draft_path = params.get("draftPath")
    output_path = params.get("outputPath")  # Caminho do arquivo ZIP de saida

    if not draft_path or not os.path.exists(draft_path):
        return {"success": False, "error": "Projeto nao encontrado"}

    if not output_path:
        return {"success": False, "error": "Caminho de saida nao especificado"}

    try:
        # Ler draft_content.json
        draft_content_path = os.path.join(draft_path, "draft_content.json")
        if not os.path.exists(draft_content_path):
            return {"success": False, "error": "draft_content.json nao encontrado"}

        with open(draft_content_path, 'r', encoding='utf-8') as f:
            draft_content = json.load(f)

        # Criar pasta temporaria para o projeto exportado
        temp_dir = os.path.join(os.path.dirname(output_path), f"temp_export_{uuid.uuid4().hex[:8]}")
        os.makedirs(temp_dir, exist_ok=True)

        # Criar pasta de midias dentro do projeto
        media_dir = os.path.join(temp_dir, "medias")
        os.makedirs(media_dir, exist_ok=True)

        # Extrair todos os caminhos de midia
        media_paths = get_all_media_paths(draft_content)

        # Copiar midias e criar mapeamento de caminhos
        path_mapping = {}
        copied_files = []

        for media in media_paths:
            original_path = media["original_path"]
            if original_path in path_mapping:
                continue  # Ja foi copiado

            # Nome unico para evitar conflitos
            filename = os.path.basename(original_path)
            base, ext = os.path.splitext(filename)
            new_filename = f"{base}_{uuid.uuid4().hex[:6]}{ext}"
            new_path = os.path.join(media_dir, new_filename)

            # Copiar arquivo
            try:
                shutil.copy2(original_path, new_path)
                # Usar caminho relativo no JSON
                relative_path = os.path.join("medias", new_filename)
                path_mapping[original_path] = relative_path
                copied_files.append(new_filename)
            except Exception as e:
                # Se nao conseguir copiar, manter o caminho original
                pass

        # Atualizar caminhos no draft_content
        updated_draft = update_media_paths(draft_content, path_mapping)

        # Salvar draft_content.json atualizado
        updated_draft_path = os.path.join(temp_dir, "draft_content.json")
        with open(updated_draft_path, 'w', encoding='utf-8') as f:
            json.dump(updated_draft, f, ensure_ascii=False, indent=2)

        # Copiar outros arquivos do projeto original (exceto draft_content.json)
        for item in os.listdir(draft_path):
            if item == "draft_content.json":
                continue
            src = os.path.join(draft_path, item)
            dst = os.path.join(temp_dir, item)
            if os.path.isfile(src):
                shutil.copy2(src, dst)
            elif os.path.isdir(src):
                shutil.copytree(src, dst)

        # Adicionar arquivo de metadados
        metadata = {
            "exported_at": datetime.now().isoformat(),
            "original_path": draft_path,
            "medias_count": len(copied_files),
            "medias": copied_files,
            "version": "1.0"
        }
        with open(os.path.join(temp_dir, "export_info.json"), 'w', encoding='utf-8') as f:
            json.dump(metadata, f, ensure_ascii=False, indent=2)

        # Criar arquivo ZIP
        if not output_path.endswith('.zip'):
            output_path += '.zip'

        with zipfile.ZipFile(output_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for root, dirs, files in os.walk(temp_dir):
                for file in files:
                    file_path = os.path.join(root, file)
                    arcname = os.path.relpath(file_path, temp_dir)
                    zipf.write(file_path, arcname)

        # Limpar pasta temporaria
        shutil.rmtree(temp_dir)

        # Calcular tamanho do arquivo
        file_size = os.path.getsize(output_path)
        file_size_mb = round(file_size / (1024 * 1024), 2)

        return {
            "success": True,
            "outputPath": output_path,
            "mediasCount": len(copied_files),
            "fileSizeMB": file_size_mb
        }

    except Exception as e:
        # Limpar pasta temporaria em caso de erro
        if 'temp_dir' in locals() and os.path.exists(temp_dir):
            shutil.rmtree(temp_dir)
        return {"success": False, "error": str(e)}


def import_project(params):
    """
    Importa um projeto de um arquivo ZIP
    - Descompacta o arquivo
    - Atualiza os caminhos das midias para caminhos absolutos
    - Retorna o caminho do projeto importado
    """
    zip_path = params.get("zipPath")
    output_dir = params.get("outputDir")  # Pasta onde extrair o projeto

    if not zip_path or not os.path.exists(zip_path):
        return {"success": False, "error": "Arquivo ZIP nao encontrado"}

    if not output_dir:
        return {"success": False, "error": "Pasta de destino nao especificada"}

    try:
        # Criar pasta de destino se nao existir
        os.makedirs(output_dir, exist_ok=True)

        # Nome da pasta do projeto (baseado no nome do ZIP)
        zip_name = os.path.splitext(os.path.basename(zip_path))[0]
        project_dir = os.path.join(output_dir, zip_name)

        # Se ja existir, adicionar sufixo
        counter = 1
        base_project_dir = project_dir
        while os.path.exists(project_dir):
            project_dir = f"{base_project_dir}_{counter}"
            counter += 1

        os.makedirs(project_dir, exist_ok=True)

        # Extrair ZIP
        with zipfile.ZipFile(zip_path, 'r') as zipf:
            zipf.extractall(project_dir)

        # Ler draft_content.json
        draft_content_path = os.path.join(project_dir, "draft_content.json")
        if not os.path.exists(draft_content_path):
            return {"success": False, "error": "draft_content.json nao encontrado no ZIP"}

        with open(draft_content_path, 'r', encoding='utf-8') as f:
            draft_content = json.load(f)

        # Atualizar caminhos relativos para absolutos
        materials = draft_content.get("materials", {})

        def update_path_to_absolute(relative_path):
            if relative_path.startswith("medias/") or relative_path.startswith("medias\\"):
                return os.path.join(project_dir, relative_path)
            return relative_path

        # Atualizar videos
        for video in materials.get("videos", []):
            path = video.get("path", "")
            if path:
                video["path"] = update_path_to_absolute(path)

        # Atualizar audios
        for audio in materials.get("audios", []):
            path = audio.get("path", "")
            if path:
                audio["path"] = update_path_to_absolute(path)

        # Atualizar images
        for image in materials.get("images", []):
            path = image.get("path", "")
            if path:
                image["path"] = update_path_to_absolute(path)

        # Salvar draft_content.json atualizado
        with open(draft_content_path, 'w', encoding='utf-8') as f:
            json.dump(draft_content, f, ensure_ascii=False, indent=2)

        # Ler metadados se existirem
        export_info = {}
        export_info_path = os.path.join(project_dir, "export_info.json")
        if os.path.exists(export_info_path):
            with open(export_info_path, 'r', encoding='utf-8') as f:
                export_info = json.load(f)

        return {
            "success": True,
            "projectPath": project_dir,
            "draftContentPath": draft_content_path,
            "exportInfo": export_info
        }

    except Exception as e:
        return {"success": False, "error": str(e)}


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

        if action == 'export':
            result = export_project(command)
        elif action == 'import':
            result = import_project(command)
        else:
            result = {"success": False, "error": f"Unknown action: {action}"}

        print(json.dumps(result, ensure_ascii=False))

    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))


if __name__ == "__main__":
    main()

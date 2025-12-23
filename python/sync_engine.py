#!/usr/bin/env python3
"""
CapCut Sync Pro - Engine (sem interface)
Extraído do sincronizar_midia_interface_simple.py
"""

import json
import sys
import os
import re
from datetime import datetime
import random
import uuid

# 14 Effect Templates
EFFECT_TEMPLATES = [
    ['335C4249-E41C-456d-9B1B-62A0B4310F5B', 'D818E6A7-E2CE-4352-B3E8-CBB047A233B8', '62814518-C7EB-4451-BA06-B05AB3406EFF', 'A0BEA477-4A91-495b-B494-666D88E7E420', '4E86696A-0003-4ad6-9528-5BA08F03D990', 'B00CF732-C69E-4aa7-A262-B56CBE002686', 'EF02E744-CBDD-4072-92BA-87C9EC505F00', '53DCC265-EAF6-4ed7-B8C2-AC8E8A74FE37'],
    ['DDEB359F-27DE-47ec-881A-A43E15A24FDA', '7A817F6B-5669-49bd-91A8-184ECFE9ED42', '043600B5-0A81-4488-A757-F1904A70EBFA', '039F7578-1AF0-4353-AACE-CEB05A3BCA7E', '9D61924A-A18F-4028-B3EE-E1E132789900', 'FF747F7A-0784-4667-87AA-FA4751B5BA10', '56D8CD51-3311-4b50-A48E-331B36E53D5F', 'D7D8396C-7442-455d-BD54-BFA6FB65A7BB'],
    ['EF117438-23A0-4853-A4B0-ABC89660B6AF', 'CA77EE42-3D76-4aba-941B-62995AAB773E', 'FFF1EB6F-3D8D-40a9-B62B-624E06A697FE', '90838DA5-647F-4ec1-BDBB-CFB0AF152F2A', 'BA071474-A3EB-4b5f-A065-349A0CD8A358', '6BC81DDD-DD42-4402-A02A-0D115A0D2E8C', 'F6F689E7-461A-45e1-9BCA-1682D327FF56', '46C5ED45-B81D-4b08-9FFF-7859A7659BC1'],
    ['9E9E457D-90A0-4748-BB80-FB5ACC7C0B0A', 'FE35B057-AA82-433c-B4F6-41C85AB94B1F', '576F0345-FCB6-435e-A74D-72DB4D383437', '6FF7548B-7D63-44b6-8104-E8A784A202BD', '586C95EF-DBA7-4faa-BD50-066334FF658D', '81035D44-839C-490c-A28F-29DD843EE810', 'C4212E51-40B3-43a6-952B-A3305F79B3F3', '704DD831-89B1-4d91-8AF1-D759F89357C2'],
    ['FDDE394B-5598-469c-9794-08D76A7F17B2', 'A92D1449-DB35-473a-9115-741AAAE0770E', 'AADAA84D-5786-417a-ABFE-462EBB4D3AAC', '1280825D-041B-412b-9D0C-68A0B31A5C0F', '1CD2DD01-ED88-47df-9388-FCD756174025', 'DCDD5140-4B95-44b6-BDDB-A3467064B2B1', '14379063-EF6E-4ef1-93DD-3BD94AA86FD8', '8D2D11B6-DF90-472d-9C96-D16E1EA250D9'],
    ['1DF9D6D7-7467-4611-92E1-B7105461C504', '317A5C3E-DC8F-43e2-B1A4-3AC91C878301', '5DE7713A-4C86-4c2c-BCBE-139FD77D3FC4', 'D595EA1E-BDFE-4c93-BCEF-7FE4BB1A32B8', '0D801368-B95E-4948-9A5C-795BEBF5FB00', '28025C4E-FFE8-40ca-8A80-5C79683F49F3', '0DA11757-04CA-42ff-AEB4-ACBC9F0061B1', '9F96A478-E6DA-4aff-B371-940611C5C7EC'],
    ['882FCCA3-66C2-4ebb-80E7-4A70A83151C5', 'F83533C5-2E7C-4d1f-8D7B-3736D2E2BAC2', '571118FA-2E5A-475f-9DBF-D1C937CCA510', 'BBB438CA-1219-4a55-BD62-0E69099D824F', '47B5AA93-AB36-4b68-826D-BF6CD573DDC3', '3E9240F7-97E6-456b-813A-B06ECD6DEF91', '94817BB2-5200-4412-AC59-A2293A27A91D', 'A34237C7-5142-4e05-AC35-0296F2D90DCF'],
    ['60B85169-6B61-4883-8A72-43B1D77EC17A', 'D86BA3EF-3B41-4bb4-9346-841886C98007', 'EC3B001E-6FE1-436e-ACF8-C8167D00F4E6', '6C58AE30-FFA6-4932-BACB-505AB8CFD4AF', '311EC067-AFB6-4d13-BDE9-850882919EB7', '0FE60A05-710D-4cdb-BD0F-0F44FF9106FF', 'A4EF468E-81BA-4604-B026-21E3E38FCCBD', '5CBA3408-2607-4d69-A6FB-BB345598E164'],
    ['0CD4772C-F04B-417b-A981-983BF0F3786F', '7AF10741-1F06-4412-9DE1-6CE3107FC071', '08DE02F6-6751-4084-AA4F-CC19219F985B', '79C001F9-AC6F-421c-ABAA-6E5056A53B09', '2E2D534E-794A-4edf-83AA-D2518F2A39B2', '01E88A7B-4887-4b83-8E3E-F7D9AEEE2921', '732C0DFC-3372-4489-9D40-AF7284EB1320', 'E2E636D2-BAEB-488b-A197-D0D9249FBF04', '507FB357-34BB-4113-B3F6-2A575FB2F7A9'],
    ['67C832BD-827D-4682-8C7D-A4EF006FC3F1', 'BED06175-299E-47fc-B8C2-D427A8D423D2', '675D62AC-0686-4b77-9952-DC2FDB4B8A04', 'A86AD8F4-BDFC-4ab8-A8F8-ACA39C1A7E79', '3B2D44E1-001C-4931-A455-7A009C67CA9A', 'BE864809-EAF6-4959-A9E1-9143A16C04AD', '70604290-2181-4daf-88AC-5BCA1DC7FD1D'],
    ['E03A98CC-16D1-4139-AE0A-5E66B46AFD5F', 'D5E941D4-612D-4b68-8590-092363CBE404', '9DC6B3CE-FD85-41ac-976F-6CFE33FE2059', '5D853D32-DE66-4a0a-B643-B8BEA5252434', '22FDD4D5-58F3-4462-9621-62F43EC48FAC', '32A10AA6-EF8C-4fcc-A7B5-0FF62E15B70C', '584421F2-B566-44e4-943D-28D5F79E248E', 'EB42CDA3-A044-4a36-8543-1CA5F88F7771'],
    ['58441C21-A6F1-4ad5-8E13-291449B7A7F5', '7C9D50BA-3228-45cb-958C-DBE6DD4B1498', '834FA4EA-5410-4eb3-8132-BD8E959F8132', '31570563-816C-44f5-A61F-3F3673D55922', '18BBE835-5FBB-4be5-9735-BD67B087E106', 'A872FFDE-9478-4f0a-9699-6FF5CADF85B2', '43779C3D-3BCC-4433-B6F2-8A5ADACF9FE6', '0E51B95F-7BF6-4cf2-A7C6-9380163E6B55'],
    ['15A8C157-6885-40c9-9B3B-4E0685518E6E', 'FBE63B83-74C7-45f5-BA2E-F561868E873B', 'B92090DB-00DD-43d9-A35D-DD62577B5F3E', '15BB2BE2-F2F0-46be-8381-36384D0043F5', '1EE18111-3EF6-4cf9-BA4D-D85C5E2DC3C3', '6755BAAD-E9D1-4dee-8F96-BDCE287EF983', '0D3A8153-A967-40c7-91DE-C112873D6F6C', '0936432E-2359-401b-B95E-233C42F19447'],
    ['C9DA3A22-4848-4290-8919-BDA55C36215C', '677460BB-6F0B-4958-99D3-BA37DA76D025', '5A8B18ED-CA25-4d3c-A70F-208718E80DE5', 'B49E96CC-3514-497e-99A4-C102966A685D', 'AF877CB7-5A1F-4ba5-9631-D44A2CAA33E1', '3CF7EB10-6E4B-4933-9CC4-261FC2A64CCE', 'F3FEFE2A-AA88-4d13-86E8-69E0F03751F5', 'AB5A8A49-CE09-4549-BA47-A7D53199743F'],
]

# ============ FUNÇÕES DE ANIMAÇÃO ============

def criar_keyframe_zoom_in_suave(duration):
    end_time = max(0, duration - 33333)
    return [
        {'id': str(uuid.uuid4()), 'material_id': '', 'property_type': 'KFTypeScaleX',
         'keyframe_list': [
             {'id': str(uuid.uuid4()), 'time_offset': 0, 'values': [1.02], 'curveType': 'Line', 'graphID': '', 'left_control': {'x': 0.0, 'y': 0.0}, 'right_control': {'x': 0.0, 'y': 0.0}, 'string_value': ''},
             {'id': str(uuid.uuid4()), 'time_offset': end_time, 'values': [1.15], 'curveType': 'Line', 'graphID': '', 'left_control': {'x': 0.0, 'y': 0.0}, 'right_control': {'x': 0.0, 'y': 0.0}, 'string_value': ''}]},
        {'id': str(uuid.uuid4()), 'material_id': '', 'property_type': 'KFTypeScaleY',
         'keyframe_list': [
             {'id': str(uuid.uuid4()), 'time_offset': 0, 'values': [1.02], 'curveType': 'Line', 'graphID': '', 'left_control': {'x': 0.0, 'y': 0.0}, 'right_control': {'x': 0.0, 'y': 0.0}, 'string_value': ''},
             {'id': str(uuid.uuid4()), 'time_offset': end_time, 'values': [1.15], 'curveType': 'Line', 'graphID': '', 'left_control': {'x': 0.0, 'y': 0.0}, 'right_control': {'x': 0.0, 'y': 0.0}, 'string_value': ''}]}
    ]

def criar_keyframe_pan_down(duration):
    end_time = max(0, duration - 33333)
    return [
        {'id': str(uuid.uuid4()), 'material_id': '', 'property_type': 'KFTypeScaleX', 'keyframe_list': [{'id': str(uuid.uuid4()), 'time_offset': 0, 'values': [1.15], 'curveType': 'Line', 'graphID': '', 'left_control': {'x': 0.0, 'y': 0.0}, 'right_control': {'x': 0.0, 'y': 0.0}, 'string_value': ''}]},
        {'id': str(uuid.uuid4()), 'material_id': '', 'property_type': 'KFTypeScaleY', 'keyframe_list': [{'id': str(uuid.uuid4()), 'time_offset': 0, 'values': [1.15], 'curveType': 'Line', 'graphID': '', 'left_control': {'x': 0.0, 'y': 0.0}, 'right_control': {'x': 0.0, 'y': 0.0}, 'string_value': ''}]},
        {'id': str(uuid.uuid4()), 'material_id': '', 'property_type': 'KFTypePositionY',
         'keyframe_list': [
             {'id': str(uuid.uuid4()), 'time_offset': 0, 'values': [-0.12], 'curveType': 'Line', 'graphID': '', 'left_control': {'x': 0.0, 'y': 0.0}, 'right_control': {'x': 0.0, 'y': 0.0}, 'string_value': ''},
             {'id': str(uuid.uuid4()), 'time_offset': end_time, 'values': [0.12], 'curveType': 'Line', 'graphID': '', 'left_control': {'x': 0.0, 'y': 0.0}, 'right_control': {'x': 0.0, 'y': 0.0}, 'string_value': ''}]}
    ]

def criar_keyframe_zoom_out(duration):
    end_time = max(0, duration - 33333)
    return [
        {'id': str(uuid.uuid4()), 'material_id': '', 'property_type': 'KFTypeScaleX',
         'keyframe_list': [
             {'id': str(uuid.uuid4()), 'time_offset': 0, 'values': [1.18], 'curveType': 'Line', 'graphID': '', 'left_control': {'x': 0.0, 'y': 0.0}, 'right_control': {'x': 0.0, 'y': 0.0}, 'string_value': ''},
             {'id': str(uuid.uuid4()), 'time_offset': end_time, 'values': [1.05], 'curveType': 'Line', 'graphID': '', 'left_control': {'x': 0.0, 'y': 0.0}, 'right_control': {'x': 0.0, 'y': 0.0}, 'string_value': ''}]},
        {'id': str(uuid.uuid4()), 'material_id': '', 'property_type': 'KFTypeScaleY',
         'keyframe_list': [
             {'id': str(uuid.uuid4()), 'time_offset': 0, 'values': [1.18], 'curveType': 'Line', 'graphID': '', 'left_control': {'x': 0.0, 'y': 0.0}, 'right_control': {'x': 0.0, 'y': 0.0}, 'string_value': ''},
             {'id': str(uuid.uuid4()), 'time_offset': end_time, 'values': [1.05], 'curveType': 'Line', 'graphID': '', 'left_control': {'x': 0.0, 'y': 0.0}, 'right_control': {'x': 0.0, 'y': 0.0}, 'string_value': ''}]}
    ]

def criar_keyframe_zoom_in_forte(duration):
    end_time = max(0, duration - 33333)
    return [
        {'id': str(uuid.uuid4()), 'material_id': '', 'property_type': 'KFTypeScaleX',
         'keyframe_list': [
             {'id': str(uuid.uuid4()), 'time_offset': 0, 'values': [1.0], 'curveType': 'Line', 'graphID': '', 'left_control': {'x': 0.0, 'y': 0.0}, 'right_control': {'x': 0.0, 'y': 0.0}, 'string_value': ''},
             {'id': str(uuid.uuid4()), 'time_offset': end_time, 'values': [1.2], 'curveType': 'Line', 'graphID': '', 'left_control': {'x': 0.0, 'y': 0.0}, 'right_control': {'x': 0.0, 'y': 0.0}, 'string_value': ''}]},
        {'id': str(uuid.uuid4()), 'material_id': '', 'property_type': 'KFTypeScaleY',
         'keyframe_list': [
             {'id': str(uuid.uuid4()), 'time_offset': 0, 'values': [1.0], 'curveType': 'Line', 'graphID': '', 'left_control': {'x': 0.0, 'y': 0.0}, 'right_control': {'x': 0.0, 'y': 0.0}, 'string_value': ''},
             {'id': str(uuid.uuid4()), 'time_offset': end_time, 'values': [1.2], 'curveType': 'Line', 'graphID': '', 'left_control': {'x': 0.0, 'y': 0.0}, 'right_control': {'x': 0.0, 'y': 0.0}, 'string_value': ''}]}
    ]

def criar_keyframe_pan_down_forte(duration):
    end_time = max(0, duration - 33333)
    return [
        {'id': str(uuid.uuid4()), 'material_id': '', 'property_type': 'KFTypeScaleX', 'keyframe_list': [{'id': str(uuid.uuid4()), 'time_offset': 0, 'values': [1.2], 'curveType': 'Line', 'graphID': '', 'left_control': {'x': 0.0, 'y': 0.0}, 'right_control': {'x': 0.0, 'y': 0.0}, 'string_value': ''}]},
        {'id': str(uuid.uuid4()), 'material_id': '', 'property_type': 'KFTypeScaleY', 'keyframe_list': [{'id': str(uuid.uuid4()), 'time_offset': 0, 'values': [1.2], 'curveType': 'Line', 'graphID': '', 'left_control': {'x': 0.0, 'y': 0.0}, 'right_control': {'x': 0.0, 'y': 0.0}, 'string_value': ''}]},
        {'id': str(uuid.uuid4()), 'material_id': '', 'property_type': 'KFTypePositionY',
         'keyframe_list': [
             {'id': str(uuid.uuid4()), 'time_offset': 0, 'values': [-0.15], 'curveType': 'Line', 'graphID': '', 'left_control': {'x': 0.0, 'y': 0.0}, 'right_control': {'x': 0.0, 'y': 0.0}, 'string_value': ''},
             {'id': str(uuid.uuid4()), 'time_offset': end_time, 'values': [0.15], 'curveType': 'Line', 'graphID': '', 'left_control': {'x': 0.0, 'y': 0.0}, 'right_control': {'x': 0.0, 'y': 0.0}, 'string_value': ''}]}
    ]

def criar_keyframe_pan_horizontal(duration):
    end_time = max(0, duration - 33333)
    return [
        {'id': str(uuid.uuid4()), 'material_id': '', 'property_type': 'KFTypeScaleX', 'keyframe_list': [{'id': str(uuid.uuid4()), 'time_offset': 0, 'values': [1.15], 'curveType': 'Line', 'graphID': '', 'left_control': {'x': 0.0, 'y': 0.0}, 'right_control': {'x': 0.0, 'y': 0.0}, 'string_value': ''}]},
        {'id': str(uuid.uuid4()), 'material_id': '', 'property_type': 'KFTypeScaleY', 'keyframe_list': [{'id': str(uuid.uuid4()), 'time_offset': 0, 'values': [1.15], 'curveType': 'Line', 'graphID': '', 'left_control': {'x': 0.0, 'y': 0.0}, 'right_control': {'x': 0.0, 'y': 0.0}, 'string_value': ''}]},
        {'id': str(uuid.uuid4()), 'material_id': '', 'property_type': 'KFTypePositionX',
         'keyframe_list': [
             {'id': str(uuid.uuid4()), 'time_offset': 0, 'values': [-0.1], 'curveType': 'Line', 'graphID': '', 'left_control': {'x': 0.0, 'y': 0.0}, 'right_control': {'x': 0.0, 'y': 0.0}, 'string_value': ''},
             {'id': str(uuid.uuid4()), 'time_offset': end_time, 'values': [0.1], 'curveType': 'Line', 'graphID': '', 'left_control': {'x': 0.0, 'y': 0.0}, 'right_control': {'x': 0.0, 'y': 0.0}, 'string_value': ''}]}
    ]

ANIMATION_PATTERNS = [criar_keyframe_zoom_in_suave, criar_keyframe_pan_down, criar_keyframe_zoom_out, criar_keyframe_zoom_in_forte, criar_keyframe_pan_down_forte, criar_keyframe_pan_horizontal]

# ============ FUNÇÕES AUXILIARES ============

def create_backup(file_path):
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = file_path.replace('.json', f'_backup_{timestamp}.json')
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    with open(backup_path, 'w', encoding='utf-8') as f:
        f.write(content)
    return backup_path

def parse_srt(filepath, debug=True):
    """
    Parse SRT file and return list of subtitles.
    debug=True will print detailed logging to stderr for debugging.
    """
    legendas = []
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        if debug:
            print(f"[SRT-DEBUG] File: {os.path.basename(filepath)}", file=sys.stderr)
            print(f"[SRT-DEBUG] Encoding: UTF-8", file=sys.stderr)
    except:
        with open(filepath, 'r', encoding='latin-1') as f:
            content = f.read()
        if debug:
            print(f"[SRT-DEBUG] File: {os.path.basename(filepath)}", file=sys.stderr)
            print(f"[SRT-DEBUG] Encoding: Latin-1 (fallback)", file=sys.stderr)

    if debug:
        print(f"[SRT-DEBUG] Content length: {len(content)} chars", file=sys.stderr)
        # Show first 500 chars for debugging
        preview = content[:500].replace('\n', '\\n').replace('\r', '\\r')
        print(f"[SRT-DEBUG] Preview: {preview}...", file=sys.stderr)

    # Normalize line endings to \n
    content = content.replace('\r\n', '\n').replace('\r', '\n')

    # Pattern that captures: index, timestamps, and text
    pattern = r'(\d+)\s*\n(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*\n([\s\S]*?)(?=\n\n|\n\d+\s*\n|$)'

    matches = re.findall(pattern, content)
    if debug:
        print(f"[SRT-DEBUG] Found {len(matches)} matches", file=sys.stderr)

    for i, match in enumerate(matches):
        idx, h1, m1, s1, ms1, h2, m2, s2, ms2, text = match
        start_us = (int(h1) * 3600 + int(m1) * 60 + int(s1)) * 1000000 + int(ms1) * 1000
        end_us = (int(h2) * 3600 + int(m2) * 60 + int(s2)) * 1000000 + int(ms2) * 1000
        original_text = text
        text = text.strip().replace('\n', ' ')

        if debug:
            print(f"[SRT-DEBUG] #{idx}: start={start_us/1000000:.2f}s, dur={(end_us-start_us)/1000000:.2f}s", file=sys.stderr)
            print(f"[SRT-DEBUG] #{idx} original: '{original_text[:100]}{'...' if len(original_text) > 100 else ''}'", file=sys.stderr)
            print(f"[SRT-DEBUG] #{idx} cleaned:  '{text[:100]}{'...' if len(text) > 100 else ''}'", file=sys.stderr)

        if text and end_us > start_us:
            legendas.append({'start': start_us, 'duration': end_us - start_us, 'text': text})
        elif debug:
            print(f"[SRT-DEBUG] #{idx} SKIPPED - empty text or invalid duration", file=sys.stderr)

    if debug:
        print(f"[SRT-DEBUG] Parsed {len(legendas)} valid subtitles", file=sys.stderr)

    return legendas

def limpar_nome_musica(nome):
    nome = os.path.splitext(nome)[0]
    return re.sub(r'^\d+[-_.\s]*', '', nome).strip()

def criar_material_texto(texto, font_size=5.0, is_subtitle=False, group_id=""):
    mat_id = str(uuid.uuid4()).upper()
    # Estrutura completa de material que o CapCut espera (baseado em importação manual)
    content = json.dumps({
        "text": texto,
        "styles": [{
            "fill": {"alpha": 1.0, "content": {"render_type": "solid", "solid": {"alpha": 1.0, "color": [1.0, 1.0, 1.0]}}},
            "font": {"id": "", "path": ""},
            "range": [0, len(texto)],
            "size": font_size
        }]
    }, ensure_ascii=False)

    return mat_id, {
        "add_type": 2,
        "alignment": 1,
        "background_alpha": 1.0,
        "background_color": "",
        "background_fill": "",
        "background_height": 0.14,
        "background_horizontal_offset": 0.0,
        "background_round_radius": 0.0,
        "background_style": 0,
        "background_vertical_offset": 0.0,
        "background_width": 0.14,
        "base_content": "",
        "bold_width": 0.0,
        "border_alpha": 1.0,
        "border_color": "",
        "border_width": 0.08,
        "caption_template_info": {"category_id": "", "category_name": "", "effect_id": "", "is_new": False, "path": "", "request_id": "", "resource_id": "", "resource_name": "", "source_platform": 0, "third_resource_id": ""},
        "check_flag": 7,
        "combo_info": {"text_templates": []},
        "content": content,
        "current_words": {"end_time": [], "start_time": [], "text": []},
        "cutoff_postfix": "",
        "enable_path_typesetting": False,
        "fixed_height": -1.0,
        "fixed_width": -1.0,
        "font_category_id": "",
        "font_category_name": "",
        "font_id": "",
        "font_name": "",
        "font_path": "",
        "font_resource_id": "",
        "font_size": font_size,
        "font_source_platform": 0,
        "font_team_id": "",
        "font_third_resource_id": "",
        "font_title": "none",
        "font_url": "",
        "fonts": [],
        "force_apply_line_max_width": False,
        "global_alpha": 1.0,
        "group_id": group_id,
        "has_shadow": False,
        "id": mat_id,
        "initial_scale": 1.0,  # CRÍTICO: deve ser 1.0, não 0.0
        "inner_padding": -1.0,
        "is_batch_replace": False,
        "is_lyric_effect": False,
        "is_rich_text": False,
        "is_words_linear": False,
        "italic_degree": 0,
        "ktv_color": "",
        "language": "",
        "layer_weight": 1,  # CRÍTICO: deve ser 1, não 0
        "letter_spacing": 0.0,
        "line_feed": 1,
        "line_max_width": 0.82,
        "line_spacing": 0.02,
        "lyric_group_id": "",
        "lyrics_template": {"category_id": "", "category_name": "", "effect_id": "", "panel": "", "path": "", "request_id": "", "resource_id": "", "resource_name": ""},
        "multi_language_current": "none",
        "name": "",
        "offset_on_path": 0.0,
        "oneline_cutoff": False,
        "operation_type": 0,
        "original_size": [],
        "preset_category": "",
        "preset_category_id": "",
        "preset_has_set_alignment": False,
        "preset_id": "",
        "preset_index": 0,
        "preset_name": "",
        "punc_model": "",
        "recognize_model": "",
        "recognize_task_id": "",
        "recognize_text": "",
        "recognize_type": 0,
        "relevance_segment": [],
        "shadow_alpha": 0.9,
        "shadow_angle": -45.0,
        "shadow_color": "",
        "shadow_distance": 5.0,
        "shadow_point": {"x": 0.6363961030678928, "y": -0.6363961030678928},
        "shadow_smoothing": 0.45,
        "shape_clip_x": False,
        "shape_clip_y": False,
        "source_from": "",
        "ssml_content": "",
        "style_name": "",
        "sub_template_id": -1,
        "sub_type": 0,
        "subtitle_keywords": None,
        "subtitle_keywords_config": None,
        "subtitle_template_original_fontsize": 0.0,
        "text_alpha": 1.0,
        "text_color": "#FFFFFF",
        "text_curve": None,
        "text_exceeds_path_process_type": 0,
        "text_loop_on_path": False,
        "text_preset_resource_id": "",
        "text_size": 30,
        "text_to_audio_ids": [],
        "text_typesetting_path_index": 0,
        "text_typesetting_paths": None,
        "text_typesetting_paths_file": "",
        "translate_original_text": "",
        "tts_auto_update": False,
        "type": "subtitle" if is_subtitle else "text",
        "typesetting": 0,
        "underline": False,
        "underline_offset": 0.22,
        "underline_width": 0.05,
        "use_effect_default_color": True,
        "words": {"end_time": [], "start_time": [], "text": []}
    }

def criar_segmento_texto(mat_id, start, duration, y_pos=-0.8, render_index=14000, track_render_index=0):
    seg_id, anim_id = str(uuid.uuid4()).upper(), str(uuid.uuid4()).upper()
    # Estrutura completa de segmento que o CapCut espera (baseado em importação manual)
    # IMPORTANTE: extra_material_refs deve apontar para material_animation, não speed
    return {
        "caption_info": None,
        "cartoon": False,
        "clip": {"alpha": 1.0, "flip": {"horizontal": False, "vertical": False}, "rotation": 0.0, "scale": {"x": 1.0, "y": 1.0}, "transform": {"x": 0.0, "y": y_pos}},
        "color_correct_alg_result": "",
        "common_keyframes": [],
        "desc": "",
        "digital_human_template_group_id": "",
        "enable_adjust": False,
        "enable_adjust_mask": False,
        "enable_color_correct_adjust": False,
        "enable_color_curves": True,
        "enable_color_match_adjust": False,
        "enable_color_wheels": True,
        "enable_hsl": False,
        "enable_hsl_curves": True,
        "enable_lut": False,
        "enable_smart_color_adjust": False,
        "enable_video_mask": True,
        "extra_material_refs": [anim_id],
        "group_id": "",
        "hdr_settings": None,
        "id": seg_id,
        "intensifies_audio": False,
        "is_loop": False,
        "is_placeholder": False,
        "is_tone_modify": False,
        "keyframe_refs": [],
        "last_nonzero_volume": 1.0,
        "lyric_keyframes": None,
        "material_id": mat_id,
        "raw_segment_id": "",
        "render_index": render_index,
        "render_timerange": {"duration": 0, "start": 0},
        "responsive_layout": {"enable": False, "horizontal_pos_layout": 0, "size_layout": 0, "target_follow": "", "vertical_pos_layout": 0},
        "reverse": False,
        "source": "segmentsourcenormal",
        "source_timerange": None,
        "speed": 1.0,
        "state": 0,
        "target_timerange": {"duration": duration, "start": start},
        "template_id": "",
        "template_scene": "default",
        "track_attribute": 0,
        "track_render_index": track_render_index,
        "uniform_scale": {"on": True, "value": 1.0},
        "visible": True,
        "volume": 1.0
    }, {"animations": [], "id": anim_id, "multi_language_current": "none", "type": "sticker_animation"}

# ============ FUNÇÕES PRINCIPAIS ============

def analyze_project(draft_path):
    try:
        with open(draft_path, 'r', encoding='utf-8') as f:
            projeto = json.load(f)
        tracks, materials = projeto.get('tracks', []), projeto.get('materials', {})
        result = []
        for idx, track in enumerate(tracks):
            segs = track.get('segments', [])
            dur = sum(s.get('target_timerange', {}).get('duration', 0) for s in segs)
            name = ''
            if segs:
                mat_id = segs[0].get('material_id', '')
                for mat_list in materials.values():
                    if isinstance(mat_list, list):
                        for m in mat_list:
                            if isinstance(m, dict) and m.get('id') == mat_id:
                                name = os.path.basename(m.get('name') or m.get('path', ''))
                                break
                    if name: break
            result.append({'index': idx, 'type': track.get('type', '?'), 'segments': len(segs), 'duration': dur, 'durationSec': dur/1000000, 'name': name})
        return {'success': True, 'tracks': result}
    except Exception as e:
        return {'error': str(e)}

def sync_project(draft_path, audio_track_index, mode='audio', sync_subtitles=True, apply_animations=False):
    try:
        logs = []
        backup_path = create_backup(draft_path)
        logs.append(f"[BACKUP] {os.path.basename(backup_path)}")
        with open(draft_path, 'r', encoding='utf-8') as f:
            projeto = json.load(f)

        audio_segs, video_segs, sub_segs = None, None, None
        for idx, t in enumerate(projeto['tracks']):
            if t['type'] == 'audio' and idx == audio_track_index: audio_segs = t['segments']
            elif t['type'] == 'video' and not video_segs: video_segs = t['segments']
            elif t['type'] in ('text', 'subtitle') and not sub_segs: sub_segs = t['segments']
        if not audio_segs:
            for t in projeto['tracks']:
                if t['type'] == 'audio': audio_segs = t['segments']; break

        gaps, media_mod, sub_mod = 0, 0, 0

        if mode == 'audio':
            if not audio_segs: return {'error': 'Sem áudio!', 'logs': logs}
            start = audio_segs[0]['target_timerange']['start']
            cur = start
            for i, s in enumerate(audio_segs):
                d = s['target_timerange']['duration']
                if i > 0 and s['target_timerange']['start'] > cur: gaps += 1
                s['target_timerange']['start'] = cur
                cur += d
            logs.append(f"Gaps removidos: {gaps}")

            if video_segs:
                cur = start
                for i in range(min(len(audio_segs), len(video_segs))):
                    ad = audio_segs[i]['target_timerange']['duration']
                    video_segs[i]['target_timerange']['start'] = cur
                    video_segs[i]['target_timerange']['duration'] = ad
                    if video_segs[i].get('source_timerange'):
                        video_segs[i]['source_timerange']['duration'] = ad
                        video_segs[i]['source_timerange']['start'] = 0
                    media_mod += 1
                    cur += ad
                logs.append(f"Mídias: {media_mod}")

            if apply_animations and video_segs:
                mats = projeto.get('materials', {})
                mat_types = {m['id']: m['type'] for ml in mats.values() if isinstance(ml, list) for m in ml if isinstance(m, dict) and 'id' in m and 'type' in m}
                photos = [s for s in video_segs if mat_types.get(s.get('material_id', '')) == 'photo']
                patterns = (ANIMATION_PATTERNS * (len(photos)//6+1))[:len(photos)]
                random.shuffle(patterns)
                for seg, pf in zip(photos, patterns):
                    dur = seg['target_timerange']['duration']
                    seg['common_keyframes'] = pf(dur)
                    seg['enable_adjust'] = True
                    if 'clip' not in seg: seg['clip'] = {'alpha': 1.0, 'flip': {'horizontal': False, 'vertical': False}, 'rotation': 0.0, 'scale': {'x': 1.0, 'y': 1.0}, 'transform': {'x': 0.0, 'y': 0.0}}
                    seg['clip']['scale'] = {'x': 1.15, 'y': 1.15}
                logs.append(f"Animações: {len(photos)} fotos")

            if sync_subtitles and sub_segs:
                cur = start
                for i in range(min(len(audio_segs), len(sub_segs))):
                    ad = audio_segs[i]['target_timerange']['duration']
                    sub_segs[i]['target_timerange']['start'] = cur
                    sub_segs[i]['target_timerange']['duration'] = ad
                    sub_mod += 1
                    cur += ad
                logs.append(f"Legendas: {sub_mod}")
        else:  # modo legenda
            if not sub_segs: return {'error': 'Sem legendas!', 'logs': logs}
            if not video_segs: return {'error': 'Sem vídeo!', 'logs': logs}
            for i in range(min(len(sub_segs), len(video_segs))):
                video_segs[i]['target_timerange']['start'] = sub_segs[i]['target_timerange']['start']
                video_segs[i]['target_timerange']['duration'] = sub_segs[i]['target_timerange']['duration']
                if video_segs[i].get('source_timerange'):
                    video_segs[i]['source_timerange']['duration'] = sub_segs[i]['target_timerange']['duration']
                media_mod += 1
            logs.append(f"Mídias por legenda: {media_mod}")

        with open(draft_path, 'w', encoding='utf-8') as f:
            json.dump(projeto, f, indent=2, ensure_ascii=False)
        logs.append("[OK] Salvo!")
        return {'success': True, 'logs': logs, 'stats': {'gapsRemoved': gaps, 'mediaModified': media_mod, 'subtitlesModified': sub_mod}}
    except Exception as e:
        return {'error': str(e)}

def loop_video(draft_path, audio_track_index, order='random'):
    try:
        logs = []
        backup_path = create_backup(draft_path)
        logs.append(f"[BACKUP] {os.path.basename(backup_path)}")
        with open(draft_path, 'r', encoding='utf-8') as f:
            projeto = json.load(f)

        dur_total = 0
        for idx, t in enumerate(projeto['tracks']):
            if t['type'] == 'audio' and idx == audio_track_index:
                for s in t['segments']: dur_total = max(dur_total, s['target_timerange']['start'] + s['target_timerange']['duration'])
                break
        if dur_total == 0:
            for t in projeto['tracks']:
                if t['type'] == 'audio':
                    for s in t['segments']: dur_total = max(dur_total, s['target_timerange']['start'] + s['target_timerange']['duration'])
                    break

        vid_idx, vid_orig = None, []
        for idx, t in enumerate(projeto['tracks']):
            if t['type'] == 'video': vid_idx, vid_orig = idx, t['segments'].copy(); break
        if not vid_orig: return {'error': 'Sem vídeo!'}

        novos, cur, ciclos = [], 0, 0
        while cur < dur_total:
            ciclos += 1
            lst = vid_orig.copy()
            if order == 'random': random.shuffle(lst)
            for s in lst:
                if cur >= dur_total: break
                ns = json.loads(json.dumps(s))
                ns['id'] = str(uuid.uuid4()).upper()
                ns['target_timerange']['start'] = cur
                novos.append(ns)
                cur += ns['target_timerange']['duration']

        projeto['tracks'][vid_idx]['segments'] = novos
        with open(draft_path, 'w', encoding='utf-8') as f:
            json.dump(projeto, f, indent=2, ensure_ascii=False)
        logs.append(f"Ciclos: {ciclos}, Total: {len(novos)}")
        return {'success': True, 'logs': logs, 'stats': {'originalCount': len(vid_orig), 'newCount': len(novos), 'cycles': ciclos}}
    except Exception as e:
        return {'error': str(e)}

def loop_audio(draft_path, track_index, target_duration):
    try:
        logs = []
        backup_path = create_backup(draft_path)
        logs.append(f"[BACKUP] {os.path.basename(backup_path)}")
        with open(draft_path, 'r', encoding='utf-8') as f:
            projeto = json.load(f)

        if track_index >= len(projeto['tracks']): return {'error': 'Track não existe!'}
        orig = projeto['tracks'][track_index]['segments'].copy()
        if not orig: return {'error': 'Sem segmentos!'}

        novos, cur, ciclos = [], 0, 0
        while cur < target_duration:
            ciclos += 1
            for s in orig:
                if cur >= target_duration: break
                ns = json.loads(json.dumps(s))
                ns['id'] = str(uuid.uuid4()).upper()
                ns['target_timerange']['start'] = cur
                novos.append(ns)
                cur += ns['target_timerange']['duration']

        projeto['tracks'][track_index]['segments'] = novos
        with open(draft_path, 'w', encoding='utf-8') as f:
            json.dump(projeto, f, indent=2, ensure_ascii=False)
        logs.append(f"Ciclos: {ciclos}, Total: {len(novos)}")
        return {'success': True, 'logs': logs, 'stats': {'originalCount': len(orig), 'newCount': len(novos), 'cycles': ciclos}}
    except Exception as e:
        return {'error': str(e)}

def insert_srt(draft_path, srt_folders=None, create_title=True, selected_file_paths=None, srt_folder=None, selected_files=None, separate_tracks=False):
    """
    Insere legendas SRT na timeline.

    Args:
        draft_path: Caminho do draft_content.json
        srt_folders: Lista de pastas contendo arquivos .srt (novo formato)
        create_title: Se True, cria texto de título para cada áudio
        selected_file_paths: Lista de CAMINHOS COMPLETOS dos arquivos .srt a inserir (novo formato)
        srt_folder: Pasta única (formato antigo, para compatibilidade)
        selected_files: Lista de nomes de arquivos (formato antigo, para compatibilidade)
        separate_tracks: Se True, cria uma track separada para cada áudio (padrão: False = todos na mesma track)
    """
    try:
        logs = []
        backup_path = create_backup(draft_path)
        logs.append(f"[BACKUP] {os.path.basename(backup_path)}")
        with open(draft_path, 'r', encoding='utf-8') as f:
            projeto = json.load(f)

        audios_mat = {m['id']: m for m in projeto.get('materials', {}).get('audios', [])}
        audios = []
        for t in projeto['tracks']:
            if t['type'] == 'audio':
                for s in t['segments']:
                    if s.get('material_id') in audios_mat:
                        audios.append({'name': audios_mat[s['material_id']].get('name', ''), 'start': s['target_timerange']['start'], 'duration': s['target_timerange']['duration']})

        total, mats, spds = 0, [], []
        all_subtitle_segs = []  # Todos os segmentos de legenda em uma única lista
        all_title_segs = []     # Títulos separados (podem sobrepor legendas)
        separate_subtitle_tracks = []  # Lista de listas, uma para cada áudio (quando separate_tracks=True)

        # NOVO FORMATO: Se selected_file_paths foi fornecido, usar caminhos completos
        if selected_file_paths:
            # Criar mapa de caminhos completos (basename -> full path)
            selected_paths_map = {os.path.splitext(os.path.basename(p))[0].lower(): p for p in selected_file_paths}
            logs.append(f"Arquivos selecionados: {len(selected_file_paths)}")

            for i, a in enumerate(audios):
                audio_basename = os.path.splitext(os.path.basename(a['name']))[0].lower()

                # Verificar se este áudio tem correspondência nos arquivos selecionados
                if audio_basename not in selected_paths_map:
                    continue  # Pular este áudio, não foi selecionado

                srt_path = selected_paths_map[audio_basename]

                # Criar título
                if create_title and os.path.exists(srt_path):
                    mid, m = criar_material_texto(limpar_nome_musica(a['name']), 7.0)
                    mats.append(m)
                    sg, sp = criar_segmento_texto(mid, a['start'], a['duration'], -0.85)
                    all_title_segs.append(sg); spds.append(sp)

                # Legendas do SRT
                if os.path.exists(srt_path):
                    gid = f"imp_{int(datetime.now().timestamp()*1000)}_{i}"
                    current_audio_segs = []  # Legendas deste áudio específico
                    for leg in parse_srt(srt_path):
                        if leg['start'] + leg['duration'] <= a['duration']:
                            mid, m = criar_material_texto(leg['text'], 5.0, True, gid)
                            mats.append(m)
                            sg, sp = criar_segmento_texto(mid, a['start'] + leg['start'], leg['duration'], -0.75)
                            if separate_tracks:
                                current_audio_segs.append(sg)
                            else:
                                all_subtitle_segs.append(sg)
                            spds.append(sp)
                            total += 1
                    if separate_tracks and current_audio_segs:
                        separate_subtitle_tracks.append(current_audio_segs)

        # FORMATO ANTIGO: Para compatibilidade com chamadas antigas
        elif srt_folder:
            # Se selected_files foi fornecido, filtrar apenas os arquivos selecionados
            if selected_files:
                selected_basenames = {os.path.splitext(f)[0].lower(): f for f in selected_files}
                logs.append(f"Arquivos selecionados: {len(selected_files)}")
            else:
                selected_basenames = None

            for i, a in enumerate(audios):
                audio_basename = os.path.splitext(a['name'])[0].lower()

                if selected_basenames is not None:
                    if audio_basename not in selected_basenames:
                        continue
                    srt_filename = selected_basenames[audio_basename]
                    srt_path = os.path.join(srt_folder, srt_filename)
                else:
                    srt_path = os.path.join(srt_folder, os.path.splitext(a['name'])[0] + '.srt')

                if create_title and os.path.exists(srt_path):
                    mid, m = criar_material_texto(limpar_nome_musica(a['name']), 7.0)
                    mats.append(m)
                    sg, sp = criar_segmento_texto(mid, a['start'], a['duration'], -0.85)
                    all_title_segs.append(sg); spds.append(sp)

                if os.path.exists(srt_path):
                    gid = f"imp_{int(datetime.now().timestamp()*1000)}_{i}"
                    current_audio_segs = []  # Legendas deste áudio específico
                    for leg in parse_srt(srt_path):
                        if leg['start'] + leg['duration'] <= a['duration']:
                            mid, m = criar_material_texto(leg['text'], 5.0, True, gid)
                            mats.append(m)
                            sg, sp = criar_segmento_texto(mid, a['start'] + leg['start'], leg['duration'], -0.75)
                            if separate_tracks:
                                current_audio_segs.append(sg)
                            else:
                                all_subtitle_segs.append(sg)
                            spds.append(sp)
                            total += 1
                    if separate_tracks and current_audio_segs:
                        separate_subtitle_tracks.append(current_audio_segs)
        else:
            return {'error': 'Nenhuma pasta ou arquivo SRT especificado'}

        # Criar tracks: uma para legendas, uma para títulos (se houver)
        # IMPORTANTE: CapCut só reconhece tipos "video", "audio", "text" - NÃO usar "subtitle"
        tracks = []
        if separate_tracks and separate_subtitle_tracks:
            # Criar uma track para cada áudio
            for track_segs in separate_subtitle_tracks:
                tracks.append({"attribute": 0, "flag": 1, "id": str(uuid.uuid4()).upper(), "is_default_name": True, "name": "", "segments": track_segs, "type": "text"})
        elif all_subtitle_segs:
            tracks.append({"attribute": 0, "flag": 1, "id": str(uuid.uuid4()).upper(), "is_default_name": True, "name": "", "segments": all_subtitle_segs, "type": "text"})
        if all_title_segs:
            tracks.append({"attribute": 0, "flag": 1, "id": str(uuid.uuid4()).upper(), "is_default_name": True, "name": "", "segments": all_title_segs, "type": "text"})

        projeto['materials'].setdefault('texts', []).extend(mats)
        projeto['materials'].setdefault('material_animations', []).extend(spds)
        projeto['tracks'].extend(tracks)

        with open(draft_path, 'w', encoding='utf-8') as f:
            json.dump(projeto, f, indent=2, ensure_ascii=False)
        logs.append(f"Legendas: {total}")
        logs.append(f"Legendas inseridas! {len(all_subtitle_segs)} segmentos em {len(tracks)} track(s)")
        return {'success': True, 'logs': logs, 'stats': {'totalSubtitles': total, 'tracksCreated': len(tracks)}}
    except Exception as e:
        return {'error': str(e)}

def insert_srt_batch(draft_path, srt_files, create_title=True, gap_ms=2000000):
    """
    Insere múltiplos arquivos SRT sequencialmente na timeline (modo em massa).
    Cada arquivo SRT é inserido um após o outro, com um espaço (gap) configurável entre eles.
    Não depende de áudio - apenas insere as legendas em sequência.

    Args:
        draft_path: Caminho do draft_content.json
        srt_files: Lista de caminhos completos dos arquivos .srt
        create_title: Se True, cria texto de título para cada arquivo
        gap_ms: Espaço em microsegundos entre cada bloco de SRT (padrão: 2 segundos)
    """
    try:
        logs = []
        backup_path = create_backup(draft_path)
        logs.append(f"[BACKUP] {os.path.basename(backup_path)}")
        with open(draft_path, 'r', encoding='utf-8') as f:
            projeto = json.load(f)

        total = 0
        mats, spds = [], []
        all_subtitle_segs = []
        all_title_segs = []

        current_time = 0  # Posição atual na timeline (em microssegundos)

        for i, srt_path in enumerate(srt_files):
            if not os.path.exists(srt_path):
                logs.append(f"[SKIP] Arquivo não encontrado: {os.path.basename(srt_path)}")
                continue

            # Parse SRT file
            legendas = parse_srt(srt_path)
            if not legendas:
                logs.append(f"[SKIP] Sem legendas: {os.path.basename(srt_path)}")
                continue

            # Calcular duração total deste bloco de SRT
            block_duration = max(leg['start'] + leg['duration'] for leg in legendas)
            block_name = os.path.splitext(os.path.basename(srt_path))[0]

            # Criar título (se habilitado)
            if create_title:
                mid, m = criar_material_texto(limpar_nome_musica(block_name), 7.0)
                mats.append(m)
                sg, sp = criar_segmento_texto(mid, current_time, block_duration, -0.85)
                all_title_segs.append(sg)
                spds.append(sp)

            # Inserir legendas deste arquivo
            gid = f"batch_{int(datetime.now().timestamp()*1000)}_{i}"
            for leg in legendas:
                mid, m = criar_material_texto(leg['text'], 5.0, True, gid)
                mats.append(m)
                # Offset pelo tempo atual da timeline
                sg, sp = criar_segmento_texto(mid, current_time + leg['start'], leg['duration'], -0.75)
                all_subtitle_segs.append(sg)
                spds.append(sp)
                total += 1

            logs.append(f"[+] {block_name}: {len(legendas)} legendas")

            # Avançar para a próxima posição (duração do bloco + gap)
            current_time += block_duration + gap_ms

        if not all_subtitle_segs:
            return {'error': 'Nenhuma legenda encontrada nos arquivos selecionados'}

        # IMPORTANTE: CapCut precisa de uma track de vídeo para renderizar legendas na timeline
        # Verificar se já existe uma track de vídeo, se não, criar uma vazia
        has_video_track = any(t.get('type') == 'video' for t in projeto.get('tracks', []))
        if not has_video_track:
            projeto['tracks'].insert(0, {
                "attribute": 0,
                "flag": 0,
                "id": str(uuid.uuid4()).upper(),
                "is_default_name": True,
                "name": "",
                "segments": [],
                "type": "video"
            })
            logs.append("[+] Track de vídeo criada (necessária para renderização)")

        # Criar tracks de texto
        # IMPORTANTE: CapCut só reconhece tipos "video", "audio", "text" - NÃO usar "subtitle"
        tracks = []
        if all_subtitle_segs:
            tracks.append({
                "attribute": 0,
                "flag": 1,
                "id": str(uuid.uuid4()).upper(),
                "is_default_name": True,
                "name": "",
                "segments": all_subtitle_segs,
                "type": "text"
            })
        if all_title_segs:
            tracks.append({
                "attribute": 0,
                "flag": 1,
                "id": str(uuid.uuid4()).upper(),
                "is_default_name": True,
                "name": "",
                "segments": all_title_segs,
                "type": "text"
            })

        # Adicionar materiais e tracks ao projeto
        projeto['materials'].setdefault('texts', []).extend(mats)
        projeto['materials'].setdefault('material_animations', []).extend(spds)
        projeto['tracks'].extend(tracks)

        # Duração total (sem o último gap)
        total_duration = current_time - gap_ms if current_time > gap_ms else current_time

        # IMPORTANTE: Definir a duration do projeto para o CapCut renderizar corretamente
        if total_duration > projeto.get('duration', 0):
            projeto['duration'] = total_duration
            logs.append(f"[+] Duration do projeto: {total_duration/1000000:.2f}s")

        with open(draft_path, 'w', encoding='utf-8') as f:
            json.dump(projeto, f, indent=2, ensure_ascii=False)

        logs.append(f"Total: {total} legendas em {len(srt_files)} arquivos")
        return {
            'success': True,
            'logs': logs,
            'stats': {
                'totalSubtitles': total,
                'totalFiles': len(srt_files),
                'tracksCreated': len(tracks),
                'totalDuration': total_duration
            }
        }
    except Exception as e:
        return {'error': str(e)}

# ============ FUNÇÕES DE MÍDIA ============

def get_media_info(file_path):
    """Obtém informações de mídia (duração, largura, altura) usando ffprobe ou valores padrão."""
    import subprocess
    ext = os.path.splitext(file_path)[1].lower()

    # Valores padrão
    duration = 5000000  # 5 segundos para imagens
    width, height = 1920, 1080
    has_audio = False
    media_type = "photo" if ext in ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'] else "video"

    try:
        cmd = ['ffprobe', '-v', 'quiet', '-print_format', 'json', '-show_format', '-show_streams', file_path]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
        if result.returncode == 0:
            info = json.loads(result.stdout)
            if 'format' in info and 'duration' in info['format']:
                duration = int(float(info['format']['duration']) * 1000000)
            for stream in info.get('streams', []):
                if stream.get('codec_type') == 'video':
                    width = stream.get('width', width)
                    height = stream.get('height', height)
                elif stream.get('codec_type') == 'audio':
                    has_audio = True
    except:
        pass

    return {'duration': duration, 'width': width, 'height': height, 'has_audio': has_audio, 'type': media_type}

def criar_material_video(file_path, duration, width, height, has_audio=True, media_type="video"):
    """Cria um material de vídeo/imagem completo."""
    mat_id = str(uuid.uuid4()).upper()
    local_mat_id = str(uuid.uuid4()).lower()

    return mat_id, local_mat_id, {
        "aigc_type": "none", "audio_fade": None, "category_name": "local", "check_flag": 62978047,
        "crop": {"lower_left_x": 0.0, "lower_left_y": 1.0, "lower_right_x": 1.0, "lower_right_y": 1.0,
                 "upper_left_x": 0.0, "upper_left_y": 0.0, "upper_right_x": 1.0, "upper_right_y": 0.0},
        "crop_ratio": "free", "crop_scale": 1.0, "duration": duration,
        "has_audio": has_audio, "has_sound_separated": False, "height": height, "id": mat_id,
        "local_material_id": local_mat_id, "material_name": os.path.basename(file_path),
        "path": file_path.replace('\\', '/'), "source": 0, "source_platform": 0,
        "type": media_type, "width": width,
        "matting": {"flag": 0, "has_use_quick_brush": False, "has_use_quick_eraser": False, "interactiveTime": [], "path": "", "strokes": []},
        "stable": {"matrix_path": "", "stable_level": 0, "time_range": {"duration": 0, "start": 0}},
        "video_algorithm": {"algorithms": [], "path": ""}
    }

def criar_materiais_auxiliares_video():
    """Cria os 6 materiais auxiliares necessários para um segmento de vídeo."""
    speed_id = str(uuid.uuid4()).upper()
    placeholder_id = str(uuid.uuid4()).upper()
    canvas_id = str(uuid.uuid4()).upper()
    channel_id = str(uuid.uuid4()).upper()
    color_id = str(uuid.uuid4()).upper()
    vocal_id = str(uuid.uuid4()).upper()

    return {
        'speed': {"curve_speed": None, "id": speed_id, "mode": 0, "speed": 1.0, "type": "speed"},
        'placeholder': {"error_path": "", "error_text": "", "id": placeholder_id, "meta_type": "none", "res_path": "", "res_text": "", "type": "placeholder_info"},
        'canvas': {"album_image": "", "blur": 0.0, "color": "", "id": canvas_id, "image": "", "image_id": "", "image_name": "", "source_platform": 0, "team_id": "", "type": "canvas_color"},
        'channel': {"audio_channel_mapping": 0, "id": channel_id, "is_config_open": False, "type": "none"},
        'color': {"gradient_angle": 90.0, "gradient_colors": [], "gradient_percents": [], "height": 0.0, "id": color_id, "is_color_clip": False, "is_gradient": False, "solid_color": "", "width": 0.0},
        'vocal': {"choice": 0, "enter_from": "", "final_algorithm": "", "id": vocal_id, "production_path": "", "removed_sounds": [], "time_range": None, "type": "vocal_separation"},
        'refs': [speed_id, placeholder_id, canvas_id, channel_id, color_id, vocal_id]
    }

def criar_segmento_video(mat_id, start, duration, extra_refs, render_index=0):
    """Cria um segmento de vídeo para a timeline."""
    seg_id = str(uuid.uuid4()).upper()
    return {
        "caption_info": None, "cartoon": False,
        "clip": {"alpha": 1.0, "flip": {"horizontal": False, "vertical": False}, "rotation": 0.0, "scale": {"x": 1.0, "y": 1.0}, "transform": {"x": 0.0, "y": 0.0}},
        "common_keyframes": [], "enable_adjust": True, "enable_color_curves": True, "enable_color_wheels": True,
        "enable_hsl_curves": True, "enable_lut": True, "enable_video_mask": True,
        "extra_material_refs": extra_refs, "group_id": "",
        "hdr_settings": {"intensity": 1.0, "mode": 1, "nits": 1000},
        "id": seg_id, "is_placeholder": False, "keyframe_refs": [], "last_nonzero_volume": 1.0,
        "material_id": mat_id, "render_index": render_index,
        "render_timerange": {"duration": 0, "start": 0},
        "responsive_layout": {"enable": False, "horizontal_pos_layout": 0, "size_layout": 0, "target_follow": "", "vertical_pos_layout": 0},
        "reverse": False, "source": "segmentsourcenormal",
        "source_timerange": {"duration": duration, "start": 0},
        "speed": 1.0, "state": 0, "target_timerange": {"duration": duration, "start": start},
        "template_id": "", "template_scene": "default", "track_attribute": 1, "track_render_index": 0,
        "uniform_scale": {"on": True, "value": 1.0}, "visible": True, "volume": 0.0
    }

def insert_media_batch(draft_path, media_files, image_duration=5000000):
    """
    Insere múltiplos arquivos de mídia (vídeo/imagem) sequencialmente na timeline.
    Arquivos são ordenados alfabeticamente.
    """
    try:
        logs = []
        backup_path = create_backup(draft_path)
        logs.append(f"[BACKUP] {os.path.basename(backup_path)}")

        with open(draft_path, 'r', encoding='utf-8') as f:
            projeto = json.load(f)

        # Ordenar arquivos alfabeticamente
        media_files = sorted(media_files, key=lambda x: os.path.basename(x).lower())
        logs.append(f"[INFO] {len(media_files)} arquivos em ordem alfabética")

        # Encontrar ou criar track de vídeo
        video_track_idx = None
        for idx, track in enumerate(projeto.get('tracks', [])):
            if track.get('type') == 'video':
                video_track_idx = idx
                break

        if video_track_idx is None:
            projeto.setdefault('tracks', []).insert(0, {
                "attribute": 0, "flag": 0, "id": str(uuid.uuid4()).upper(),
                "is_default_name": True, "name": "", "segments": [], "type": "video"
            })
            video_track_idx = 0
            logs.append("[+] Track de vídeo criada")

        # Calcular posição inicial
        current_time = 0
        if projeto['tracks'][video_track_idx].get('segments'):
            last_seg = projeto['tracks'][video_track_idx]['segments'][-1]
            current_time = last_seg['target_timerange']['start'] + last_seg['target_timerange']['duration']

        # Processar cada arquivo
        for file_path in media_files:
            if not os.path.exists(file_path):
                logs.append(f"[SKIP] Não encontrado: {os.path.basename(file_path)}")
                continue

            info = get_media_info(file_path)
            duration = image_duration if info['type'] == 'photo' else info['duration']

            # Criar material
            mat_id, local_mat_id, video_mat = criar_material_video(
                file_path, duration, info['width'], info['height'], info['has_audio'], info['type']
            )
            projeto['materials'].setdefault('videos', []).append(video_mat)

            # Criar materiais auxiliares
            aux = criar_materiais_auxiliares_video()
            projeto['materials'].setdefault('speeds', []).append(aux['speed'])
            projeto['materials'].setdefault('placeholder_infos', []).append(aux['placeholder'])
            projeto['materials'].setdefault('canvases', []).append(aux['canvas'])
            projeto['materials'].setdefault('sound_channel_mappings', []).append(aux['channel'])
            projeto['materials'].setdefault('material_colors', []).append(aux['color'])
            projeto['materials'].setdefault('vocal_separations', []).append(aux['vocal'])

            # Criar segmento
            segment = criar_segmento_video(mat_id, current_time, duration, aux['refs'])
            projeto['tracks'][video_track_idx]['segments'].append(segment)

            logs.append(f"[+] {os.path.basename(file_path)} ({duration/1000000:.2f}s)")
            current_time += duration

        # Atualizar duração do projeto
        if current_time > projeto.get('duration', 0):
            projeto['duration'] = current_time
            logs.append(f"[+] Duração: {current_time/1000000:.2f}s")

        with open(draft_path, 'w', encoding='utf-8') as f:
            json.dump(projeto, f, indent=2, ensure_ascii=False)

        return {'success': True, 'logs': logs, 'stats': {'totalMedia': len(media_files), 'totalDuration': current_time}}
    except Exception as e:
        return {'error': str(e)}

# ============ FUNÇÕES DE ÁUDIO ============

def criar_material_audio(file_path, duration):
    """Cria um material de áudio completo."""
    mat_id = str(uuid.uuid4()).upper()
    local_mat_id = str(uuid.uuid4()).lower()
    music_id = str(uuid.uuid4()).lower()

    return mat_id, local_mat_id, {
        "category_name": "local", "check_flag": 1, "duration": duration,
        "id": mat_id, "local_material_id": local_mat_id, "music_id": music_id,
        "name": os.path.basename(file_path), "path": file_path.replace('\\', '/'),
        "source_platform": 0, "type": "extract_music", "wave_points": []
    }

def criar_materiais_auxiliares_audio():
    """Cria os 5 materiais auxiliares necessários para um segmento de áudio."""
    speed_id = str(uuid.uuid4()).upper()
    placeholder_id = str(uuid.uuid4()).upper()
    beat_id = str(uuid.uuid4()).upper()
    channel_id = str(uuid.uuid4()).upper()
    vocal_id = str(uuid.uuid4()).upper()

    return {
        'speed': {"curve_speed": None, "id": speed_id, "mode": 0, "speed": 1.0, "type": "speed"},
        'placeholder': {"error_path": "", "error_text": "", "id": placeholder_id, "meta_type": "none", "res_path": "", "res_text": "", "type": "placeholder_info"},
        'beat': {"ai_beats": {"beat_speed_infos": [], "beats_path": "", "beats_url": "", "melody_path": "", "melody_percents": [0.0], "melody_url": ""}, "enable_ai_beats": False, "gear": 404, "gear_count": 0, "id": beat_id, "mode": 404, "type": "beats", "user_beats": [], "user_delete_ai_beats": None},
        'channel': {"audio_channel_mapping": 0, "id": channel_id, "is_config_open": False, "type": "none"},
        'vocal': {"choice": 0, "enter_from": "", "final_algorithm": "", "id": vocal_id, "production_path": "", "removed_sounds": [], "time_range": None, "type": "vocal_separation"},
        'refs': [speed_id, placeholder_id, beat_id, channel_id, vocal_id]
    }

def criar_segmento_audio(mat_id, start, duration, extra_refs, render_index=0):
    """Cria um segmento de áudio para a timeline."""
    seg_id = str(uuid.uuid4()).upper()
    return {
        "caption_info": None, "cartoon": False, "clip": None,
        "common_keyframes": [], "enable_adjust": False, "enable_color_curves": True, "enable_color_wheels": True,
        "enable_hsl_curves": True, "enable_video_mask": True,
        "extra_material_refs": extra_refs, "group_id": "",
        "id": seg_id, "is_placeholder": False, "keyframe_refs": [], "last_nonzero_volume": 1.0,
        "material_id": mat_id, "render_index": render_index,
        "render_timerange": {"duration": 0, "start": 0},
        "responsive_layout": {"enable": False, "horizontal_pos_layout": 0, "size_layout": 0, "target_follow": "", "vertical_pos_layout": 0},
        "reverse": False, "source": "segmentsourcenormal",
        "source_timerange": {"duration": duration, "start": 0},
        "speed": 1.0, "state": 0, "target_timerange": {"duration": duration, "start": start},
        "template_id": "", "template_scene": "default", "track_attribute": 0, "track_render_index": 1,
        "uniform_scale": None, "visible": True, "volume": 1.0
    }

def insert_audio_batch(draft_path, audio_files, use_existing_track=False, track_index=None):
    """
    Insere múltiplos arquivos de áudio sequencialmente na timeline.

    Args:
        draft_path: Caminho do draft_content.json
        audio_files: Lista de caminhos completos dos arquivos de áudio
        use_existing_track: Se True, usa track existente. Se False, cria nova.
        track_index: Índice da track a usar (se use_existing_track=True)
    """
    try:
        logs = []
        backup_path = create_backup(draft_path)
        logs.append(f"[BACKUP] {os.path.basename(backup_path)}")

        with open(draft_path, 'r', encoding='utf-8') as f:
            projeto = json.load(f)

        # Ordenar arquivos alfabeticamente
        audio_files = sorted(audio_files, key=lambda x: os.path.basename(x).lower())
        logs.append(f"[INFO] {len(audio_files)} arquivos em ordem alfabética")

        # Encontrar ou criar track de áudio
        audio_track_idx = None

        if use_existing_track and track_index is not None:
            # Usar track especificada
            if track_index < len(projeto.get('tracks', [])):
                if projeto['tracks'][track_index].get('type') == 'audio':
                    audio_track_idx = track_index
                    logs.append(f"[INFO] Usando track de áudio existente (índice {track_index})")

        if audio_track_idx is None:
            # Criar nova track de áudio
            new_track = {
                "attribute": 0, "flag": 0, "id": str(uuid.uuid4()).upper(),
                "is_default_name": True, "name": "", "segments": [], "type": "audio"
            }
            projeto.setdefault('tracks', []).append(new_track)
            audio_track_idx = len(projeto['tracks']) - 1
            logs.append("[+] Nova track de áudio criada")

        # Calcular posição inicial
        current_time = 0
        if projeto['tracks'][audio_track_idx].get('segments'):
            last_seg = projeto['tracks'][audio_track_idx]['segments'][-1]
            current_time = last_seg['target_timerange']['start'] + last_seg['target_timerange']['duration']

        # Processar cada arquivo
        for file_path in audio_files:
            if not os.path.exists(file_path):
                logs.append(f"[SKIP] Não encontrado: {os.path.basename(file_path)}")
                continue

            # Obter duração do áudio
            info = get_media_info(file_path)
            duration = info['duration']

            # Criar material de áudio
            mat_id, local_mat_id, audio_mat = criar_material_audio(file_path, duration)
            projeto['materials'].setdefault('audios', []).append(audio_mat)

            # Criar materiais auxiliares
            aux = criar_materiais_auxiliares_audio()
            projeto['materials'].setdefault('speeds', []).append(aux['speed'])
            projeto['materials'].setdefault('placeholder_infos', []).append(aux['placeholder'])
            projeto['materials'].setdefault('beats', []).append(aux['beat'])
            projeto['materials'].setdefault('sound_channel_mappings', []).append(aux['channel'])
            projeto['materials'].setdefault('vocal_separations', []).append(aux['vocal'])

            # Criar segmento
            segment = criar_segmento_audio(mat_id, current_time, duration, aux['refs'])
            projeto['tracks'][audio_track_idx]['segments'].append(segment)

            logs.append(f"[+] {os.path.basename(file_path)} ({duration/1000000:.2f}s)")
            current_time += duration

        # Atualizar duração do projeto
        if current_time > projeto.get('duration', 0):
            projeto['duration'] = current_time
            logs.append(f"[+] Duração: {current_time/1000000:.2f}s")

        with open(draft_path, 'w', encoding='utf-8') as f:
            json.dump(projeto, f, indent=2, ensure_ascii=False)

        return {'success': True, 'logs': logs, 'stats': {'totalAudio': len(audio_files), 'totalDuration': current_time}}
    except Exception as e:
        return {'error': str(e)}

# ============ RANDOMIZE EXISTING MEDIA ============
def randomize_existing_media(draft_path):
    """Randomiza a ordem das mídias existentes na timeline (mantém durações, troca materiais)"""
    try:
        logs = []
        backup_path = create_backup(draft_path)
        logs.append(f"[BACKUP] {os.path.basename(backup_path)}")

        with open(draft_path, 'r', encoding='utf-8') as f:
            projeto = json.load(f)

        # Encontrar track de vídeo (type == 'video')
        video_track_idx = None
        for idx, track in enumerate(projeto.get('tracks', [])):
            if track.get('type') == 'video':
                video_track_idx = idx
                break

        if video_track_idx is None:
            return {'error': 'Nenhuma track de vídeo encontrada'}

        segments = projeto['tracks'][video_track_idx].get('segments', [])
        if len(segments) < 2:
            return {'error': 'Precisa de pelo menos 2 segmentos para randomizar'}

        logs.append(f"[INFO] {len(segments)} segmentos encontrados")

        # Coletar os material_ids de cada segmento
        material_ids = [seg.get('material_id') for seg in segments]

        # Embaralhar os material_ids
        shuffled_ids = material_ids.copy()
        random.shuffle(shuffled_ids)

        # Aplicar os material_ids embaralhados aos segmentos
        for i, seg in enumerate(segments):
            old_id = seg.get('material_id')
            new_id = shuffled_ids[i]
            seg['material_id'] = new_id

            # Também atualizar extra_material_refs se existir
            for ref in seg.get('extra_material_refs', []):
                if ref == old_id:
                    seg['extra_material_refs'][seg['extra_material_refs'].index(ref)] = new_id

        logs.append(f"[+] Ordem randomizada!")

        # Salvar
        with open(draft_path, 'w', encoding='utf-8') as f:
            json.dump(projeto, f, indent=2, ensure_ascii=False)

        return {'success': True, 'logs': logs, 'stats': {'totalMedia': len(segments)}}
    except Exception as e:
        return {'error': str(e)}

# ============ IMPORT MEDIA FROM FOLDER ============
def import_media_folder(draft_path, folder_path, add_animations=True, sync_to_audio=True):
    """
    Importa todas as mídias de uma pasta para o projeto CapCut.
    Detecta automaticamente imagens, vídeos e áudios.
    Arquivos são ordenados alfabeticamente.

    Args:
        draft_path: Caminho do draft_content.json
        folder_path: Pasta contendo as mídias
        add_animations: Se True, adiciona animações às imagens
        sync_to_audio: Se True, sincroniza duração das imagens com o áudio total
    """
    try:
        logs = []
        backup_path = create_backup(draft_path)
        logs.append(f"[BACKUP] {os.path.basename(backup_path)}")

        with open(draft_path, 'r', encoding='utf-8') as f:
            projeto = json.load(f)

        if not os.path.exists(folder_path):
            return {'error': f'Pasta não encontrada: {folder_path}'}

        # Extensões suportadas
        IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp']
        VIDEO_EXTS = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v']
        AUDIO_EXTS = ['.wav', '.mp3', '.m4a', '.aac', '.ogg', '.flac']
        SUBTITLE_EXTS = ['.srt', '.vtt']

        # Listar e classificar arquivos
        all_files = []
        subtitle_files = []
        for f in os.listdir(folder_path):
            full_path = os.path.join(folder_path, f)
            if not os.path.isfile(full_path):
                continue
            ext = os.path.splitext(f)[1].lower()
            if ext in IMAGE_EXTS:
                all_files.append({'path': full_path, 'name': f, 'type': 'image', 'ext': ext})
            elif ext in VIDEO_EXTS:
                all_files.append({'path': full_path, 'name': f, 'type': 'video', 'ext': ext})
            elif ext in AUDIO_EXTS:
                all_files.append({'path': full_path, 'name': f, 'type': 'audio', 'ext': ext})
            elif ext in SUBTITLE_EXTS:
                subtitle_files.append({'path': full_path, 'name': f, 'ext': ext})

        if not all_files:
            return {'error': 'Nenhuma mídia encontrada na pasta'}

        # Ordenar alfabeticamente
        all_files.sort(key=lambda x: x['name'].lower())

        # Separar por tipo
        images = [f for f in all_files if f['type'] == 'image']
        videos = [f for f in all_files if f['type'] == 'video']
        audios = [f for f in all_files if f['type'] == 'audio']

        logs.append(f"[INFO] Encontrados: {len(images)} imagens, {len(videos)} vídeos, {len(audios)} áudios, {len(subtitle_files)} legendas")

        # Calcular duração total dos áudios
        total_audio_duration = 0
        audio_durations = []
        for audio in audios:
            try:
                if audio['ext'] == '.wav':
                    import wave
                    with wave.open(audio['path'], 'rb') as wav:
                        frames = wav.getnframes()
                        rate = wav.getframerate()
                        dur = int((frames / rate) * 1000000)
                else:
                    # Usar ffprobe para outros formatos
                    import subprocess
                    cmd = ['ffprobe', '-v', 'quiet', '-print_format', 'json', '-show_format', audio['path']]
                    result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
                    if result.returncode == 0:
                        info = json.loads(result.stdout)
                        dur = int(float(info.get('format', {}).get('duration', 5)) * 1000000)
                    else:
                        dur = 5000000
                audio_durations.append(dur)
                total_audio_duration += dur
            except:
                dur = 5000000
                audio_durations.append(dur)
                total_audio_duration += dur

        logs.append(f"[INFO] Duração total áudio: {total_audio_duration/1000000:.2f}s")

        # Calcular duração por imagem/vídeo
        visual_media = images + videos
        visual_media.sort(key=lambda x: x['name'].lower())

        if sync_to_audio and total_audio_duration > 0 and len(images) > 0 and len(videos) == 0:
            # Modo sincronizado: distribuir imagens pela duração do áudio
            image_duration = total_audio_duration // len(images)
            logs.append(f"[INFO] Modo sincronizado: {image_duration/1000000:.2f}s por imagem")
        else:
            # Modo padrão: 5 segundos por imagem
            image_duration = 5000000

        # Encontrar ou criar track de vídeo
        video_track_idx = None
        for idx, track in enumerate(projeto.get('tracks', [])):
            if track.get('type') == 'video':
                video_track_idx = idx
                break

        if video_track_idx is None:
            projeto.setdefault('tracks', []).insert(0, {
                "attribute": 0, "flag": 0, "id": str(uuid.uuid4()).upper(),
                "is_default_name": True, "name": "", "segments": [], "type": "video"
            })
            video_track_idx = 0
            logs.append("[+] Track de vídeo criada")

        # Calcular posição inicial
        current_time = 0
        if projeto['tracks'][video_track_idx].get('segments'):
            last_seg = projeto['tracks'][video_track_idx]['segments'][-1]
            current_time = last_seg['target_timerange']['start'] + last_seg['target_timerange']['duration']

        start_time = current_time

        # Lista de animações
        animation_funcs = [
            criar_keyframe_zoom_in_suave,
            criar_keyframe_pan_down,
            criar_keyframe_zoom_out,
            criar_keyframe_zoom_in_forte,
            criar_keyframe_pan_down_forte,
            criar_keyframe_pan_horizontal
        ]

        # Inserir mídia visual (imagens e vídeos)
        media_inserted = 0
        for i, media in enumerate(visual_media):
            info = get_media_info(media['path'])

            if media['type'] == 'image':
                duration = image_duration
                media_type = 'photo'
            else:
                duration = info['duration']
                media_type = info['type']

            # Criar material
            mat_id, local_mat_id, video_mat = criar_material_video(
                media['path'], duration, info['width'], info['height'], info['has_audio'], media_type
            )
            projeto['materials'].setdefault('videos', []).append(video_mat)

            # Materiais auxiliares
            aux = criar_materiais_auxiliares_video()
            projeto['materials'].setdefault('speeds', []).append(aux['speed'])
            projeto['materials'].setdefault('placeholder_infos', []).append(aux['placeholder'])
            projeto['materials'].setdefault('canvases', []).append(aux['canvas'])
            projeto['materials'].setdefault('sound_channel_mappings', []).append(aux['channel'])
            projeto['materials'].setdefault('material_colors', []).append(aux['color'])
            projeto['materials'].setdefault('vocal_separations', []).append(aux['vocal'])

            # Criar segmento
            segment = criar_segmento_video(mat_id, current_time, duration, aux['refs'])

            # Animação para imagens
            if add_animations and media['type'] == 'image':
                anim_func = animation_funcs[i % len(animation_funcs)]
                keyframes = anim_func(duration)
                for kf in keyframes:
                    kf['material_id'] = mat_id
                segment['common_keyframes'] = keyframes

            projeto['tracks'][video_track_idx]['segments'].append(segment)
            current_time += duration
            media_inserted += 1

        logs.append(f"[+] {media_inserted} mídias visuais inseridas")

        # Inserir áudios
        if audios:
            audio_track_idx = None
            for idx, track in enumerate(projeto.get('tracks', [])):
                if track.get('type') == 'audio':
                    audio_track_idx = idx
                    break

            if audio_track_idx is None:
                projeto['tracks'].append({
                    "attribute": 0, "flag": 0, "id": str(uuid.uuid4()).upper(),
                    "is_default_name": True, "name": "", "segments": [], "type": "audio"
                })
                audio_track_idx = len(projeto['tracks']) - 1
                logs.append("[+] Track de áudio criada")

            audio_time = start_time
            for i, audio in enumerate(audios):
                duration = audio_durations[i]

                mat_id, local_mat_id, audio_mat = criar_material_audio(audio['path'], duration)
                projeto['materials'].setdefault('audios', []).append(audio_mat)

                aux = criar_materiais_auxiliares_audio()
                projeto['materials'].setdefault('speeds', []).append(aux['speed'])
                projeto['materials'].setdefault('placeholder_infos', []).append(aux['placeholder'])
                projeto['materials'].setdefault('beats', []).append(aux['beat'])
                projeto['materials'].setdefault('sound_channel_mappings', []).append(aux['channel'])
                projeto['materials'].setdefault('vocal_separations', []).append(aux['vocal'])

                audio_segment = criar_segmento_audio(mat_id, audio_time, duration, aux['refs'])
                projeto['tracks'][audio_track_idx]['segments'].append(audio_segment)
                audio_time += duration

            logs.append(f"[+] {len(audios)} áudios inseridos ({total_audio_duration/1000000:.2f}s)")

        # Inserir legendas (SRT)
        subtitles_inserted = 0
        if subtitle_files:
            # Ordenar legendas alfabeticamente
            subtitle_files.sort(key=lambda x: x['name'].lower())

            for srt_file in subtitle_files:
                try:
                    legendas = parse_srt(srt_file['path'])
                    if not legendas:
                        logs.append(f"[SKIP] Legenda vazia: {srt_file['name']}")
                        continue

                    # Criar track de legenda se não existir
                    text_track_idx = None
                    for idx, track in enumerate(projeto.get('tracks', [])):
                        if track.get('type') == 'text':
                            text_track_idx = idx
                            break

                    if text_track_idx is None:
                        projeto['tracks'].append({
                            "attribute": 0, "flag": 0, "id": str(uuid.uuid4()).upper(),
                            "is_default_name": True, "name": "", "segments": [], "type": "text"
                        })
                        text_track_idx = len(projeto['tracks']) - 1
                        logs.append("[+] Track de legenda criada")

                    # Inserir cada legenda
                    for leg in legendas:
                        mat_id = str(uuid.uuid4()).upper()
                        texto = leg['text']
                        inicio = start_time + leg['start']  # Ajustar para posição inicial das mídias
                        duracao = leg['duration']  # parse_srt já retorna duration calculado

                        # Criar material de texto
                        text_mat = {
                            "add_type": 2,
                            "alignment": 1,
                            "background_alpha": 1.0,
                            "background_color": "",
                            "background_height": 0.14,
                            "background_horizontal_offset": 0.0,
                            "background_round_radius": 0.0,
                            "background_style": 0,
                            "background_vertical_offset": 0.0,
                            "background_width": 0.14,
                            "bold_width": 0.0,
                            "border_alpha": 1.0,
                            "border_color": "",
                            "border_width": 0.08,
                            "caption_template_info": {"category_id": "", "category_name": "", "effect_id": "", "is_new": False, "path": "", "request_id": "", "resource_id": "", "resource_name": ""},
                            "check_flag": 7,
                            "combo_info": {"text_templates": []},
                            "content": texto,
                            "fixed_height": -1.0,
                            "fixed_width": -1.0,
                            "font_category_id": "",
                            "font_category_name": "",
                            "font_id": "",
                            "font_name": "",
                            "font_path": "",
                            "font_resource_id": "",
                            "font_size": 8.0,
                            "font_source_platform": 0,
                            "font_team_id": "",
                            "font_title": "none",
                            "font_url": "",
                            "fonts": [],
                            "force_apply_line_max_width": False,
                            "global_alpha": 1.0,
                            "group_id": "",
                            "has_shadow": False,
                            "id": mat_id,
                            "initial_scale": 1.0,
                            "inner_padding": -1.0,
                            "is_rich_text": False,
                            "is_subtitle": True,
                            "is_words_linear": False,
                            "italic_degree": 0,
                            "ktv_color": "",
                            "language": "",
                            "layer_weight": 1,
                            "letter_spacing": 0.0,
                            "line_feed": 1,
                            "line_max_width": 0.82,
                            "line_spacing": 0.02,
                            "multi_language_current": "none",
                            "name": "",
                            "original_size": [],
                            "preset_category": "",
                            "preset_category_id": "",
                            "preset_has_set_alignment": False,
                            "preset_id": "",
                            "preset_index": 0,
                            "preset_name": "",
                            "recognize_task_id": "",
                            "recognize_type": 0,
                            "relevance_segment": [],
                            "shadow_alpha": 0.9,
                            "shadow_angle": -45.0,
                            "shadow_color": "",
                            "shadow_distance": 5.0,
                            "shadow_point": {"x": 0.6363961030678927, "y": -0.6363961030678927},
                            "shadow_smoothing": 0.45,
                            "shape_clip_x": False,
                            "shape_clip_y": False,
                            "style_name": "",
                            "sub_type": 0,
                            "subtitle_keywords": None,
                            "subtitle_template_original_fontsize": 0.0,
                            "text_alpha": 1.0,
                            "text_color": "#FFFFFF",
                            "text_curve": None,
                            "text_preset_resource_id": "",
                            "text_size": 30,
                            "text_to_audio_ids": [],
                            "tts_auto_update": False,
                            "type": "subtitle",
                            "typesetting": 0,
                            "underline": False,
                            "underline_offset": 0.22,
                            "underline_width": 0.05,
                            "use_effect_default_color": True,
                            "words": {"end_time": [], "start_time": [], "text": []}
                        }
                        projeto['materials'].setdefault('texts', []).append(text_mat)

                        # Criar segmento
                        seg = {
                            "caption_info": None,
                            "cartoon": False,
                            "clip": {"alpha": 1.0, "flip": {"horizontal": False, "vertical": False}, "rotation": 0.0, "scale": {"x": 1.0, "y": 1.0}, "transform": {"x": 0.0, "y": -0.75}},
                            "common_keyframes": [],
                            "enable_adjust": True,
                            "enable_color_correct_adjust": False,
                            "enable_color_curves": True,
                            "enable_color_match_adjust": False,
                            "enable_color_wheels": True,
                            "enable_lut": True,
                            "enable_smart_color_adjust": False,
                            "extra_material_refs": [],
                            "group_id": "",
                            "hdr_settings": {"intensity": 1.0, "mode": 1, "nits": 1000},
                            "id": str(uuid.uuid4()).upper(),
                            "intensifies_audio": False,
                            "is_placeholder": False,
                            "is_tone_modify": False,
                            "keyframe_refs": [],
                            "last_nonzero_volume": 1.0,
                            "material_id": mat_id,
                            "render_index": 0,
                            "responsive_layout": {"enable": False, "horizontal_pos_layout": 0, "size_layout": 0, "target_follow": "", "vertical_pos_layout": 0},
                            "reverse": False,
                            "source_timerange": {"duration": duracao, "start": 0},
                            "speed": 1.0,
                            "target_timerange": {"duration": duracao, "start": inicio},
                            "template_id": "",
                            "template_scene": "default",
                            "track_attribute": 0,
                            "track_render_index": 0,
                            "uniform_scale": {"on": True, "value": 1.0},
                            "visible": True,
                            "volume": 1.0
                        }
                        projeto['tracks'][text_track_idx]['segments'].append(seg)
                        subtitles_inserted += 1

                    logs.append(f"[+] Legenda importada: {srt_file['name']} ({len(legendas)} textos)")
                except Exception as e:
                    logs.append(f"[ERRO] Falha na legenda {srt_file['name']}: {str(e)}")

        # Atualizar duração
        final_duration = max(current_time, start_time + total_audio_duration)
        if final_duration > projeto.get('duration', 0):
            projeto['duration'] = final_duration

        with open(draft_path, 'w', encoding='utf-8') as f:
            json.dump(projeto, f, indent=2, ensure_ascii=False)

        logs.append(f"[OK] Importação concluída! Duração: {final_duration/1000000:.2f}s")

        return {
            'success': True,
            'logs': logs,
            'stats': {
                'imagesInserted': len(images),
                'videosInserted': len(videos),
                'audiosInserted': len(audios),
                'subtitlesInserted': subtitles_inserted,
                'totalDuration': final_duration
            }
        }
    except Exception as e:
        import traceback
        return {'error': str(e), 'traceback': traceback.format_exc()}

# ============ INSERT CREATOR CONTENT ============
def insert_creator_content(draft_path, content_folder, add_animations=True):
    """
    Insere conteúdo gerado pelo Creator (imagens + áudio) no projeto.
    Distribui as imagens uniformemente pela duração do áudio.

    Args:
        draft_path: Caminho do draft_content.json
        content_folder: Pasta do projeto gerado (contém imagens/, audio.wav, roteiro.txt)
        add_animations: Se True, adiciona animações às imagens
    """
    try:
        logs = []
        backup_path = create_backup(draft_path)
        logs.append(f"[BACKUP] {os.path.basename(backup_path)}")

        with open(draft_path, 'r', encoding='utf-8') as f:
            projeto = json.load(f)

        # Verificar arquivos do conteúdo
        images_folder = os.path.join(content_folder, 'imagens')
        audios_folder = os.path.join(content_folder, 'audios')
        audio_completo_file = os.path.join(content_folder, 'audio_completo.wav')

        if not os.path.exists(images_folder):
            return {'error': f'Pasta de imagens não encontrada: {images_folder}'}

        # Listar imagens ordenadas
        image_files = sorted([
            os.path.join(images_folder, f)
            for f in os.listdir(images_folder)
            if f.lower().endswith(('.png', '.jpg', '.jpeg', '.webp'))
        ])

        if not image_files:
            return {'error': 'Nenhuma imagem encontrada na pasta'}

        logs.append(f"[INFO] {len(image_files)} imagens encontradas")

        # Verificar partes de áudio individuais
        audio_parts = []
        if os.path.exists(audios_folder):
            audio_parts = sorted([
                os.path.join(audios_folder, f)
                for f in os.listdir(audios_folder)
                if f.lower().startswith('parte_') and f.lower().endswith('.wav')
            ])

        # Calcular duração total do áudio (partes ou completo)
        audio_duration = 0
        audio_parts_info = []  # Lista de (path, duration) para cada parte

        if audio_parts:
            import wave
            for part_path in audio_parts:
                try:
                    with wave.open(part_path, 'rb') as wav:
                        frames = wav.getnframes()
                        rate = wav.getframerate()
                        part_duration = int((frames / rate) * 1000000)  # microseconds
                        audio_parts_info.append((part_path, part_duration))
                        audio_duration += part_duration
                except Exception as e:
                    logs.append(f"[WARN] Erro ao ler {os.path.basename(part_path)}: {e}")
            logs.append(f"[INFO] {len(audio_parts_info)} partes de áudio ({audio_duration/1000000:.2f}s total)")
        elif os.path.exists(audio_completo_file):
            try:
                import wave
                with wave.open(audio_completo_file, 'rb') as wav:
                    frames = wav.getnframes()
                    rate = wav.getframerate()
                    audio_duration = int((frames / rate) * 1000000)  # microseconds
                    audio_parts_info.append((audio_completo_file, audio_duration))
                logs.append(f"[INFO] Áudio completo: {audio_duration/1000000:.2f}s")
            except Exception as e:
                logs.append(f"[WARN] Erro ao ler áudio: {e}")
                audio_duration = len(image_files) * 5000000
        else:
            # Sem áudio: 5 segundos por imagem
            audio_duration = len(image_files) * 5000000
            logs.append(f"[INFO] Sem áudio, usando {audio_duration/1000000:.2f}s total")

        # Calcular duração por imagem
        image_duration = audio_duration // len(image_files)
        logs.append(f"[INFO] Duração por imagem: {image_duration/1000000:.2f}s")

        # Encontrar ou criar track de vídeo
        video_track_idx = None
        for idx, track in enumerate(projeto.get('tracks', [])):
            if track.get('type') == 'video':
                video_track_idx = idx
                break

        if video_track_idx is None:
            projeto.setdefault('tracks', []).insert(0, {
                "attribute": 0, "flag": 0, "id": str(uuid.uuid4()).upper(),
                "is_default_name": True, "name": "", "segments": [], "type": "video"
            })
            video_track_idx = 0
            logs.append("[+] Track de vídeo criada")

        # Calcular posição inicial (final do último segmento ou 0)
        current_time = 0
        if projeto['tracks'][video_track_idx].get('segments'):
            last_seg = projeto['tracks'][video_track_idx]['segments'][-1]
            current_time = last_seg['target_timerange']['start'] + last_seg['target_timerange']['duration']

        start_time = current_time  # Guardar para o áudio

        # Lista de animações disponíveis
        animation_funcs = [
            criar_keyframe_zoom_in_suave,
            criar_keyframe_pan_down,
            criar_keyframe_zoom_out,
            criar_keyframe_zoom_in_forte,
            criar_keyframe_pan_down_forte,
            criar_keyframe_pan_horizontal
        ]

        # Inserir imagens
        for i, file_path in enumerate(image_files):
            info = get_media_info(file_path)

            # Criar material de vídeo/imagem
            mat_id, local_mat_id, video_mat = criar_material_video(
                file_path, image_duration, info['width'], info['height'], False, 'photo'
            )
            projeto['materials'].setdefault('videos', []).append(video_mat)

            # Criar materiais auxiliares
            aux = criar_materiais_auxiliares_video()
            projeto['materials'].setdefault('speeds', []).append(aux['speed'])
            projeto['materials'].setdefault('placeholder_infos', []).append(aux['placeholder'])
            projeto['materials'].setdefault('canvases', []).append(aux['canvas'])
            projeto['materials'].setdefault('sound_channel_mappings', []).append(aux['channel'])
            projeto['materials'].setdefault('material_colors', []).append(aux['color'])
            projeto['materials'].setdefault('vocal_separations', []).append(aux['vocal'])

            # Criar segmento
            segment = criar_segmento_video(mat_id, current_time, image_duration, aux['refs'])

            # Adicionar animação
            if add_animations:
                anim_func = animation_funcs[i % len(animation_funcs)]
                keyframes = anim_func(image_duration)
                for kf in keyframes:
                    kf['material_id'] = mat_id
                segment['common_keyframes'] = keyframes

            projeto['tracks'][video_track_idx]['segments'].append(segment)
            current_time += image_duration

        logs.append(f"[+] {len(image_files)} imagens inseridas")

        # Inserir áudio se existir (partes individuais ou completo)
        if audio_parts_info:
            # Criar track de áudio
            audio_track_idx = None
            for idx, track in enumerate(projeto.get('tracks', [])):
                if track.get('type') == 'audio':
                    audio_track_idx = idx
                    break

            if audio_track_idx is None:
                projeto['tracks'].append({
                    "attribute": 0, "flag": 0, "id": str(uuid.uuid4()).upper(),
                    "is_default_name": True, "name": "", "segments": [], "type": "audio"
                })
                audio_track_idx = len(projeto['tracks']) - 1
                logs.append("[+] Track de áudio criada")

            # Inserir cada parte de áudio
            audio_time = start_time
            for part_path, part_duration in audio_parts_info:
                # Criar material de áudio
                mat_id, local_mat_id, audio_mat = criar_material_audio(part_path, part_duration)
                projeto['materials'].setdefault('audios', []).append(audio_mat)

                # Criar materiais auxiliares do áudio
                aux = criar_materiais_auxiliares_audio()
                projeto['materials'].setdefault('speeds', []).append(aux['speed'])
                projeto['materials'].setdefault('placeholder_infos', []).append(aux['placeholder'])
                projeto['materials'].setdefault('beats', []).append(aux['beat'])
                projeto['materials'].setdefault('sound_channel_mappings', []).append(aux['channel'])
                projeto['materials'].setdefault('vocal_separations', []).append(aux['vocal'])

                # Criar segmento de áudio
                audio_segment = criar_segmento_audio(mat_id, audio_time, part_duration, aux['refs'])
                projeto['tracks'][audio_track_idx]['segments'].append(audio_segment)
                audio_time += part_duration

            logs.append(f"[+] {len(audio_parts_info)} áudio(s) inserido(s) ({audio_duration/1000000:.2f}s total)")

        # Atualizar duração do projeto
        if current_time > projeto.get('duration', 0):
            projeto['duration'] = current_time

        # Salvar
        with open(draft_path, 'w', encoding='utf-8') as f:
            json.dump(projeto, f, indent=2, ensure_ascii=False)

        logs.append(f"[OK] Conteúdo inserido! Duração total: {current_time/1000000:.2f}s")

        return {
            'success': True,
            'logs': logs,
            'stats': {
                'imagesInserted': len(image_files),
                'audioInserted': len(audio_parts_info) > 0,
                'audioPartsInserted': len(audio_parts_info),
                'totalDuration': current_time
            }
        }
    except Exception as e:
        import traceback
        return {'error': str(e), 'traceback': traceback.format_exc()}

# ============ MAIN ============
if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(json.dumps({'error': 'Uso: python sync_engine.py <json> ou --file <arquivo>'}))
        sys.exit(1)
    try:
        # Suporta --file para comandos muito grandes
        if sys.argv[1] == '--file' and len(sys.argv) >= 3:
            with open(sys.argv[2], 'r', encoding='utf-8') as f:
                cmd = json.load(f)
        else:
            cmd = json.loads(sys.argv[1])
        action = cmd.get('action')
        if action == 'analyze': r = analyze_project(cmd['draftPath'])
        elif action == 'sync': r = sync_project(cmd['draftPath'], cmd.get('audioTrackIndex', 0), cmd.get('mode', 'audio'), cmd.get('syncSubtitles', True), cmd.get('applyAnimations', False))
        elif action == 'loop_video': r = loop_video(cmd['draftPath'], cmd.get('audioTrackIndex', 0), cmd.get('order', 'random'))
        elif action == 'loop_audio': r = loop_audio(cmd['draftPath'], cmd['trackIndex'], cmd['targetDuration'])
        elif action == 'insert_srt': r = insert_srt(cmd['draftPath'], cmd.get('srtFolders'), cmd.get('createTitle', True), cmd.get('selectedFilePaths'), cmd.get('srtFolder'), cmd.get('selectedFiles'), cmd.get('separateTracks', False))
        elif action == 'insert_srt_batch': r = insert_srt_batch(cmd['draftPath'], cmd.get('srtFiles', []), cmd.get('createTitle', True), cmd.get('gapMs', 2000000))
        elif action == 'insert_media': r = insert_media_batch(cmd['draftPath'], cmd.get('mediaFiles', []), cmd.get('imageDuration', 5000000))
        elif action == 'insert_audio': r = insert_audio_batch(cmd['draftPath'], cmd.get('audioFiles', []), cmd.get('useExistingTrack', False), cmd.get('trackIndex'))
        elif action == 'randomize_media': r = randomize_existing_media(cmd['draftPath'])
        elif action == 'insert_creator': r = insert_creator_content(cmd['draftPath'], cmd['contentFolder'], cmd.get('addAnimations', True))
        elif action == 'import_folder': r = import_media_folder(cmd['draftPath'], cmd['folderPath'], cmd.get('addAnimations', True), cmd.get('syncToAudio', True))
        else: r = {'error': f'Ação: {action}?'}
        print(json.dumps(r, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({'error': str(e)}))

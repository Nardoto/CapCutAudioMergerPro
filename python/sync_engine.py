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

def parse_srt(filepath):
    legendas = []
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
    except:
        with open(filepath, 'r', encoding='latin-1') as f:
            content = f.read()
    pattern = r'(\d+)\s*\n(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*\n([\s\S]*?)(?=\n\n|\n\d+\s*\n|$)'
    for match in re.findall(pattern, content):
        idx, h1, m1, s1, ms1, h2, m2, s2, ms2, text = match
        start_us = (int(h1) * 3600 + int(m1) * 60 + int(s1)) * 1000000 + int(ms1) * 1000
        end_us = (int(h2) * 3600 + int(m2) * 60 + int(s2)) * 1000000 + int(ms2) * 1000
        text = text.strip().replace('\n', ' ')
        if text and end_us > start_us:
            legendas.append({'start': start_us, 'duration': end_us - start_us, 'text': text})
    return legendas

def limpar_nome_musica(nome):
    nome = os.path.splitext(nome)[0]
    return re.sub(r'^\d+[-_.\s]*', '', nome).strip()

def criar_material_texto(texto, font_size=5.0, is_subtitle=False, group_id=""):
    mat_id = str(uuid.uuid4()).upper()
    return mat_id, {"add_type": 2, "alignment": 1, "background_alpha": 1.0, "check_flag": 7,
        "content": json.dumps({"text": texto, "styles": [{"fill": {"content": {"render_type": "solid", "solid": {"color": [1,1,1]}}}, "font": {"path": "", "id": ""}, "size": font_size, "range": [0, len(texto)]}]}, ensure_ascii=False),
        "font_size": font_size, "global_alpha": 1.0, "group_id": group_id, "id": mat_id, "line_max_width": 0.82,
        "text_alpha": 1.0, "text_color": "#FFFFFF", "type": "subtitle" if is_subtitle else "text", "words": {"end_time": [], "start_time": [], "text": []}}

def criar_segmento_texto(mat_id, start, duration, y_pos=-0.8):
    seg_id, spd_id = str(uuid.uuid4()).upper(), str(uuid.uuid4()).upper()
    return {"clip": {"alpha": 1.0, "flip": {"horizontal": False, "vertical": False}, "rotation": 0.0, "scale": {"x": 1.0, "y": 1.0}, "transform": {"x": 0.0, "y": y_pos}},
        "common_keyframes": [], "extra_material_refs": [spd_id], "id": seg_id, "material_id": mat_id, "target_timerange": {"duration": duration, "start": start}, "visible": True}, \
        {"id": spd_id, "mode": 0, "speed": 1.0, "type": "speed"}

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

def insert_srt(draft_path, srt_folder, create_title=True):
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

        total, mats, spds, tracks = 0, [], [], []
        for i, a in enumerate(audios):
            srt_path = os.path.join(srt_folder, os.path.splitext(a['name'])[0] + '.srt')
            segs = []
            if create_title:
                mid, m = criar_material_texto(limpar_nome_musica(a['name']), 7.0)
                mats.append(m)
                sg, sp = criar_segmento_texto(mid, a['start'], a['duration'], -0.85)
                segs.append(sg); spds.append(sp)
            if os.path.exists(srt_path):
                gid = f"imp_{int(datetime.now().timestamp()*1000)}_{i}"
                for leg in parse_srt(srt_path):
                    if leg['start'] + leg['duration'] <= a['duration']:
                        mid, m = criar_material_texto(leg['text'], 5.0, True, gid)
                        mats.append(m)
                        sg, sp = criar_segmento_texto(mid, a['start'] + leg['start'], leg['duration'], -0.75)
                        segs.append(sg); spds.append(sp); total += 1
            if segs:
                tracks.append({"attribute": 0, "flag": 0, "id": str(uuid.uuid4()).upper(), "is_default_name": True, "name": "", "segments": segs, "type": "text"})

        projeto['materials'].setdefault('texts', []).extend(mats)
        projeto['materials'].setdefault('speeds', []).extend(spds)
        projeto['tracks'].extend(tracks)

        with open(draft_path, 'w', encoding='utf-8') as f:
            json.dump(projeto, f, indent=2, ensure_ascii=False)
        logs.append(f"Legendas: {total}")
        return {'success': True, 'logs': logs, 'stats': {'totalSubtitles': total, 'tracksCreated': len(tracks)}}
    except Exception as e:
        return {'error': str(e)}

# ============ MAIN ============
if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(json.dumps({'error': 'Uso: python sync_engine.py <json>'}))
        sys.exit(1)
    try:
        cmd = json.loads(sys.argv[1])
        action = cmd.get('action')
        if action == 'analyze': r = analyze_project(cmd['draftPath'])
        elif action == 'sync': r = sync_project(cmd['draftPath'], cmd.get('audioTrackIndex', 0), cmd.get('mode', 'audio'), cmd.get('syncSubtitles', True), cmd.get('applyAnimations', False))
        elif action == 'loop_video': r = loop_video(cmd['draftPath'], cmd.get('audioTrackIndex', 0), cmd.get('order', 'random'))
        elif action == 'loop_audio': r = loop_audio(cmd['draftPath'], cmd['trackIndex'], cmd['targetDuration'])
        elif action == 'insert_srt': r = insert_srt(cmd['draftPath'], cmd['srtFolder'], cmd.get('createTitle', True))
        else: r = {'error': f'Ação: {action}?'}
        print(json.dumps(r, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({'error': str(e)}))

import psutil
import os
import asyncio
from typing import Dict, Any, List
import logging
from .orchestrator_utils import get_socket_session, stop_bot_container

logger = logging.getLogger("bot_manager.dashboard")

DOCKER_HOST = os.environ.get("DOCKER_HOST", "unix://var/run/docker.sock")

async def get_system_stats() -> Dict[str, Any]:
    """Retorna estatísticas de uso do sistema."""
    return {
        "cpu_percent": psutil.cpu_percent(interval=None),
        "memory": {
            "total": psutil.virtual_memory().total,
            "available": psutil.virtual_memory().available,
            "percent": psutil.virtual_memory().percent,
            "used": psutil.virtual_memory().used
        },
        "disk": {
            "percent": psutil.disk_usage('/').percent
        },
        "uptime": psutil.boot_time()
    }

async def get_all_containers_status() -> List[Dict[str, Any]]:
    """Lista todos os containers relacionados ao projeto e seu status."""
    session = get_socket_session()
    if not session:
        return []

    socket_path_relative = DOCKER_HOST.split('//', 1)[1]
    socket_path_abs = f"/{socket_path_relative}"
    socket_path_encoded = socket_path_abs.replace("/", "%2F")
    socket_url_base = f'http+unix://{socket_path_encoded}'
    
    try:
        response = session.get(f'{socket_url_base}/containers/json?all=true')
        response.raise_for_status()
        containers = response.json()
        
        relevant_containers = []
        for c in containers:
            name = c.get('Names', [''])[0].lstrip('/')
            # Filtra por nomes que contenham bot, whisper, sortebem ou easypanel
            if any(term in name.lower() for term in ['bot', 'whisper', 'sortebem', 'vexa']):
                relevant_containers.append({
                    "id": c.get('Id')[:12],
                    "name": name,
                    "image": c.get('Image'),
                    "status": c.get('Status'),
                    "state": c.get('State')
                })
        return relevant_containers
    except Exception as e:
        logger.error(f"Erro ao listar containers para dashboard: {e}")
        return []

async def kill_all_bots() -> Dict[str, Any]:
    """Para todos os containers de bot ativos."""
    session = get_socket_session()
    if not session:
        return {"success": False, "error": "Docker session not available"}

    socket_path_relative = DOCKER_HOST.split('//', 1)[1]
    socket_path_abs = f"/{socket_path_relative}"
    socket_path_encoded = socket_path_abs.replace("/", "%2F")
    socket_url_base = f'http+unix://{socket_path_encoded}'
    
    try:
        response = session.get(f'{socket_url_base}/containers/json?filters={{"name":["vexa-bot"]}}')
        response.raise_for_status()
        bots = response.json()
        
        killed_count = 0
        for bot in bots:
            if stop_bot_container(bot['Id']):
                killed_count += 1
        
        return {"success": True, "killed": killed_count}
    except Exception as e:
        return {"success": False, "error": str(e)}

async def restart_container(container_name_substring: str) -> Dict[str, Any]:
    """Reinicia um container que contenha o termo no nome."""
    session = get_socket_session()
    if not session:
        return {"success": False, "error": "Docker session not available"}

    socket_path_relative = DOCKER_HOST.split('//', 1)[1]
    socket_path_abs = f"/{socket_path_relative}"
    socket_path_encoded = socket_path_abs.replace("/", "%2F")
    socket_url_base = f'http+unix://{socket_path_encoded}'
    
    try:
        response = session.get(f'{socket_url_base}/containers/json?all=true')
        response.raise_for_status()
        containers = response.json()
        
        target_id = None
        for c in containers:
            name = c.get('Names', [''])[0].lstrip('/')
            if container_name_substring in name:
                target_id = c.get('Id')
                break
        
        if not target_id:
            return {"success": False, "error": f"Container {container_name_substring} não encontrado"}

        restart_response = session.post(f'{socket_url_base}/containers/{target_id}/restart?t=5')
        restart_response.raise_for_status()
        
        return {"success": True}
    except Exception as e:
        return {"success": False, "error": str(e)}

async def stop_single_container(container_id: str) -> Dict[str, Any]:
    """Para um container específico pelo ID."""
    try:
        if stop_bot_container(container_id):
            return {"success": True}
        return {"success": False, "error": "Falha ao parar container"}
    except Exception as e:
        return {"success": False, "error": str(e)}

async def remove_exited_containers() -> Dict[str, Any]:
    """Remove todos os containers que não estão rodando."""
    session = get_socket_session()
    if not session: return {"success": False}
    
    socket_path_relative = DOCKER_HOST.split('//', 1)[1]
    socket_path_abs = f"/{socket_path_relative}"
    socket_path_encoded = socket_path_abs.replace("/", "%2F")
    socket_url_base = f'http+unix://{socket_path_encoded}'
    
    try:
        # Pega containers parados
        response = session.get(f'{socket_url_base}/containers/json?all=true&filters={{"status":["exited","dead","created"]}}')
        containers = response.json()
        
        removed = 0
        for c in containers:
            name = c.get('Names', [''])[0].lstrip('/')
            # Apenas remove se for do projeto (bot ou vexa)
            if any(term in name.lower() for term in ['bot', 'vexa']):
                session.delete(f"{socket_url_base}/containers/{c['Id']}?force=true")
                removed += 1
        return {"success": True, "removed": removed}
    except Exception as e:
        return {"success": False, "error": str(e)}

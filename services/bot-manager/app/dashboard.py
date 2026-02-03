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
    try:
        from .orchestrator_utils import get_docker_client
        docker = await get_docker_client()
        containers = await docker.containers.list(all=True)
        
        relevant_containers = []
        for c in containers:
            data = c._container
            name = data.get('Names', [''])[0].lstrip('/')
            # Filtra por nomes que contenham bot, whisper, sortebem ou vexa
            if any(term in name.lower() for term in ['bot', 'whisper', 'sortebem', 'vexa']):
                relevant_containers.append({
                    "id": data.get('Id')[:12],
                    "name": name,
                    "image": data.get('Image'),
                    "status": data.get('Status'),
                    "state": data.get('State')
                })
        return relevant_containers
    except Exception as e:
        logger.error(f"Erro ao listar containers para dashboard: {e}")
        return []

async def kill_all_bots() -> Dict[str, Any]:
    """Para todos os containers de bot ativos."""
    try:
        from .orchestrator_utils import get_docker_client
        docker = await get_docker_client()
        containers = await docker.containers.list()
        
        killed_count = 0
        for c in containers:
            data = c._container
            name = data.get('Names', [''])[0].lstrip('/')
            if "vexa-bot" in name:
                await c.stop()
                killed_count += 1
        
        return {"success": True, "killed": killed_count}
    except Exception as e:
        logger.error(f"Erro ao matar bots: {e}")
        return {"success": False, "error": str(e)}

async def restart_container(container_name_substring: str) -> Dict[str, Any]:
    """Reinicia um container que contenha o termo no nome."""
    try:
        from .orchestrator_utils import get_docker_client
        docker = await get_docker_client()
        containers = await docker.containers.list(all=True)
        
        for c in containers:
            data = c._container
            name = data.get('Names', [''])[0].lstrip('/')
            if container_name_substring in name:
                await c.restart()
                return {"success": True}
        
        return {"success": False, "error": f"Container {container_name_substring} não encontrado"}
    except Exception as e:
        return {"success": False, "error": str(e)}

async def stop_single_container(container_id: str) -> Dict[str, Any]:
    """Para um container específico pelo ID."""
    try:
        from .orchestrator_utils import get_docker_client
        docker = await get_docker_client()
        container = await docker.containers.get(container_id)
        await container.stop()
        return {"success": True}
    except Exception as e:
        return {"success": False, "error": str(e)}

async def remove_exited_containers() -> Dict[str, Any]:
    """Remove todos os containers que não estão rodando."""
    try:
        from .orchestrator_utils import get_docker_client
        docker = await get_docker_client()
        # Filtra containers parados
        containers = await docker.containers.list(all=True, filters={"status": ["exited", "dead", "created"]})
        
        removed = 0
        for c in containers:
            data = c._container
            name = data.get('Names', [''])[0].lstrip('/')
            # Apenas remove se for do projeto (bot ou vexa)
            if any(term in name.lower() for term in ['bot', 'vexa']):
                await c.delete(force=True)
                removed += 1
        return {"success": True, "removed": removed}
    except Exception as e:
        logger.error(f"Erro ao remover containers: {e}")
        return {"success": False, "error": str(e)}

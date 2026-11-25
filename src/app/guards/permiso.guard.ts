import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { AdminMetadata } from '../models/user-metadata';
import { ClavePermiso, RolesPermisosService } from '../services/roles-permisos.service';

function normalizarRutaAbsoluta(ruta?: string | null): string {
  if (!ruta) return '/home';
  const limpia = ruta.trim().replace(/^\/+/, '');
  return limpia ? `/${limpia}` : '/home';
}

async function obtenerRolUsuario(authService: AuthService): Promise<string | null> {
  const user: any = await authService.getUser();
  if (!user) return null;

  const metadata = user.user_metadata as AdminMetadata;
  return metadata?.rol || user.perfil?.rol || localStorage.getItem('rol');
}

export function permisoGuard(permisoRequerido: ClavePermiso): CanActivateFn {
  return async () => {
    const authService = inject(AuthService);
    const rolesService = inject(RolesPermisosService);
    const router = inject(Router);

    try {
      const rol = await obtenerRolUsuario(authService);
      if (rol === 'admin') {
        return true;
      }

      const autorizado = await rolesService.tienePermiso(permisoRequerido);
      if (autorizado) {
        return true;
      }

      const rutasPermitidas = rolesService.obtenerRutasPermitidas();
      if (rutasPermitidas.length > 0) {
        const destino = normalizarRutaAbsoluta(rutasPermitidas[0].ruta);
        return router.createUrlTree([destino]);
      }
    } catch (error) {
      console.error('Error al validar permiso en guard:', error);
    }

    return router.createUrlTree(['/home']);
  };
}
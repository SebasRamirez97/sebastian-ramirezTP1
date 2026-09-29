import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { ClienteMetadata, EmpleadoMetadata, AdminMetadata, AnonimoMetadata } from '../models/user-metadata';

export const loginGuard: CanActivateFn = async (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // 1. Verificar cliente/usuario registrado
  const user = await authService.getUser();
  if (user) {
    const metadata = user.user_metadata as ClienteMetadata | EmpleadoMetadata | AdminMetadata;
    const rol = metadata?.rol || user.perfil?.rol || localStorage.getItem('rol');

    if (rol) {
      router.navigate(['/home']);
      return false;
    }
  }

  // 2. Verificar cliente anónimo
  const anonimo = authService.getAnonimo();
  if (anonimo) {
    const metadata = anonimo as AnonimoMetadata;
    if (metadata.rol === 'anonimo') {
      router.navigate(['/home']);
      return false;
    }
  }

  // 3. Si no hay sesión activa -> permitir acceso a login/register
  return true;
};
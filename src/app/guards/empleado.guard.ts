import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { EmpleadoMetadata } from '../models/user-metadata';

export const empleadoGuard: CanActivateFn = async (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const user = await authService.getUser();
  if (user) {
    const metadata = user.user_metadata as EmpleadoMetadata;
    const rol = metadata?.rol || user.perfil?.rol || localStorage.getItem('rol');

    if (rol === 'empleado') {
      return true;
    }
  }

  router.navigate(['/home']);
  return false;
};
import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { ClienteMetadata, EmpleadoMetadata, AdminMetadata, AnonimoMetadata } from '../models/user-metadata';

@Injectable({
  providedIn: 'root'
})
export class LoginGuard implements CanActivate {
  constructor(private authService: AuthService, private router: Router) {}

  async canActivate(): Promise<boolean> {
    // 1. Verificar cliente registrado (Supabase Auth)
    const user = await this.authService.getUser();
    if (user) {
      const metadata = user.user_metadata as ClienteMetadata | EmpleadoMetadata | AdminMetadata;
      if (metadata.rol) {
        // 👇 ya hay sesión activa → redirigir
        this.router.navigate(['/home']);
        return false;
      }
    }

    // 2. Verificar cliente anónimo
    const anonimo = this.authService.getAnonimo();
    if (anonimo) {
      const metadata = anonimo as AnonimoMetadata;
      if (metadata.rol === 'anonimo') {
        this.router.navigate(['/home']);
        return false;
      }
    }

    // 3. Si no hay sesión → permitir acceso a login
    return true;
  }
}

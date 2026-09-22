import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { EmpleadoMetadata } from '../models/user-metadata'

@Injectable({
  providedIn: 'root'
})
export class EmpleadoGuard implements CanActivate {
  constructor(private authService: AuthService, private router: Router) {}

  async canActivate(): Promise<boolean> {
    const user = await this.authService.getUser();
    if (user){
      const metadata = user.user_metadata as EmpleadoMetadata; // 👈 casteo explícito
      if (metadata.rol === 'empleado') return true;
    }

    this.router.navigate(['/home']);
    return false;
  }
}

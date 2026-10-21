import { Component, signal, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-login',
  imports: [FormsModule],
  standalone: true,
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
  // 🔹 Inyección moderna con inject()
  private authService = inject(AuthService);
  private router = inject(Router);

  // 🔹 Definición de estados con Signals
  email = signal<string>('');
  password = signal<string>('');
  nombreAnonimo = signal<string>('');

  async login(): Promise<void> {
    try {
      // 🔹 Retorna el usuario enriquecido con la propiedad "perfil"
      const usuario = await this.authService.signIn(this.email(), this.password());

      if (usuario) {
        localStorage.removeItem('clienteAnonimo'); // Limpiar estado anónimo

        // 🔹 Leer el rol desde "perfil" (Base de Datos) en lugar de user_metadata
        const rol = usuario.perfil?.rol;

        if (rol) {
          localStorage.setItem('rol', rol);
        }

        if (rol === 'admin' || rol === 'empleado' || rol === 'cliente') {
          this.router.navigate(['/home']);
        } else {
          alert('Rol no reconocido');
        }
        return;
      }

      alert('Credenciales inválidas');
    } catch (err: any) {
      console.error('Error en login:', err.message);
      alert('Error al iniciar sesión');
    }
  }

  loginAnonimo(): void {
    const cliente = this.authService.loginAnonimo(this.nombreAnonimo());
    if (!cliente) {
      alert('Debes ingresar un nombre para continuar como invitado.');
      return;
    }
    localStorage.setItem('rol', cliente.rol);
    this.router.navigate(['/home']); // Home mostrará sección anónimo
  }

  irARegistro(): void {
    this.router.navigate(['/register']);
  }
}
import { Component } from '@angular/core';
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
  email: string = '';
  password: string = '';

  constructor(private authService: AuthService, private router: Router) {}

  async login() {
    try {
      // 1. Intentar login de cliente registrado (Supabase Auth)
      const cliente = await this.authService.signIn(this.email, this.password);
      if (cliente?.user) {
        localStorage.removeItem('clienteAnonimo'); // limpiar estado anónimo
        this.router.navigate(['/home']);
        return;
      }

      // 2. Intentar login de personal (empleado/admin)
      const personal = await this.authService.loginPersonal(this.email, this.password);
      if (personal) {
        localStorage.removeItem('clienteAnonimo'); // limpiar estado anónimo
        if (personal.rol === 'admin') {
          this.router.navigate(['/home']); // Home mostrará sección admin
        } else if (personal.rol === 'empleado') {
          this.router.navigate(['/home']); // Home mostrará sección empleado
        }
        return;
      }

      // 3. Si no coincide en ningún lado
      alert('Credenciales inválidas');
    } catch (err: any) {
      console.error('Error en login:', err.message);
      alert('Error al iniciar sesión');
    }
  }

  loginAnonimo() {
    const anonimo = this.authService.loginAnonimo('Invitado');
    this.router.navigate(['/home']); // Home mostrará sección anónimo
  }
}


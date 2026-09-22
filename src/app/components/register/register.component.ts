import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.css']
})
export class RegisterComponent {
  cliente = {
    email: '',
    password: '',
    nombre: '',
    apellido: '',
    fechaNacimiento: '',
    tipoSangre: '',
    colorOjos: '',
    vacaciones: 0
  };

  constructor(private authService: AuthService, private router: Router) {}

  async registrarCliente() {
    try {
      const res = await this.authService.signUp(this.cliente);
      console.log('Cliente registrado:', res);
      this.router.navigate(['/login']);
    } catch (err: any) {
      console.error('Error en registro:', err.message);
      alert('Error al registrar cliente');
    }
  }
}


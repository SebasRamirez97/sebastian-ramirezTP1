import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { FormGroup, FormControl, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-registrar-empleado',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule],
  templateUrl: './registrar-empleado.component.html',
  styleUrls: ['./registrar-empleado.component.css']
})
export class RegistrarEmpleadoComponent {
  
  // 🔹 Formulario exclusivo para empleados (email, password, nombre, apellido)
  formEmpleado = new FormGroup({
    email: new FormControl('', [Validators.required, Validators.email]),
    password: new FormControl('', [Validators.required, Validators.minLength(6)]),
    nombre: new FormControl('', [Validators.required, Validators.minLength(2)]),
    apellido: new FormControl('', [Validators.required])
  });

  submitted = false;

  constructor(private authService: AuthService, private router: Router) {}

  async registrarEmpleado() {
    this.submitted = true;
    if (this.formEmpleado.invalid) {
      this.formEmpleado.markAllAsTouched();
      return;
    }

    try {
      const empleadoData = this.formEmpleado.value as { email: string; password: string; nombre: string; apellido: string };
      const res = await this.authService.signUpEmpleado(empleadoData);
      console.log('Empleado registrado exitosamente:', res);
      alert('¡Empleado registrado con éxito!');
      
      // Opcional: Redirigir al panel de administración o limpiar formulario
      this.formEmpleado.reset();
      this.submitted = false;
    } catch (err: any) {
      console.error('Error al registrar empleado:', err.message);
      alert('Error al registrar empleado: ' + err.message);
    }
  }

  volver() {
    this.formEmpleado.reset();
    this.submitted = false;
    // Redirige a donde consideres necesario para el administrador (ej: /admin/dashboard)
    this.router.navigate(['/home']); 
  }
}
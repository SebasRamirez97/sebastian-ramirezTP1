import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { FormGroup, FormControl, Validators, ReactiveFormsModule, AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { CommonModule } from '@angular/common';

export function mayorDeEdadValidator(edadMinima: number): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (!control.value) {
      return null; // Si está vacío, de eso se encarga Validators.required
    }

    const fechaNacimiento = new Date(control.value);
    const hoy = new Date();

    // Cálculo exacto de la edad
    let edad = hoy.getFullYear() - fechaNacimiento.getFullYear();
    const mes = hoy.getMonth() - fechaNacimiento.getMonth();

    if (mes < 0 || (mes === 0 && hoy.getDate() < fechaNacimiento.getDate())) {
      edad--;
    }

    return edad >= edadMinima ? null : { menorDeEdad: true };
  };
}



@Component({
  selector: 'app-register',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.css']
})
export class RegisterComponent {
  // 🔹 Definición del formulario reactivo
  formCliente = new FormGroup({
    email: new FormControl('', [Validators.required, Validators.email]),
    password: new FormControl('', [Validators.required, Validators.minLength(6)]),
    nombre: new FormControl('', [Validators.required, Validators.minLength(3)]),
    apellido: new FormControl('', [Validators.required]),
    fechaNacimiento: new FormControl('', [Validators.required,mayorDeEdadValidator(13)]),
    tipoSangre: new FormControl('', [Validators.required]),
    colorOjos: new FormControl('', [Validators.required]),
    vacaciones: new FormControl('', [Validators.required, Validators.min(0)])
  });

  constructor(private authService: AuthService, private router: Router) {}
  submitted = false;
  async registrarCliente() {
    this.submitted = true;
  if (this.formCliente.invalid) {
    this.formCliente.markAllAsTouched(); // 👈 fuerza mostrar errores
    return; // no envía nada
  }

  try {
    const cliente = this.formCliente.value;
    const res = await this.authService.signUpCliente(cliente as any);
    console.log('Cliente registrado:', res);
    this.router.navigate(['/login']);
  } catch (err: any) {
    console.error('Error en registro:', err.message);
    alert('Error al registrar cliente');
  }
}

  volverAlLogin() {
  this.submitted = false; // 👈 Reinicia la bandera
  this.formCliente.reset();
  this.router.navigate(['/login']);
}
}

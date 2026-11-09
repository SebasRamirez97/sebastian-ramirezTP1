import { Component, EventEmitter, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AdminCuponesService } from '../../services/admin-cupones.service';
import { SelectorFechaComponent } from '../selector-fecha/selector-fecha';

@Component({
  selector: 'app-crear-cupon',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, SelectorFechaComponent],
  templateUrl: './crear-cupon.html',
  styleUrls: ['./crear-cupon.css']
})
export class CrearCuponComponent {
  private fb = inject(FormBuilder);
  private couponService = inject(AdminCuponesService);

  @Output() couponCreated = new EventEmitter<void>();

  // Formulario simplificado (sin primera compra ni edad manual obligatoria al crear)
  cuponForm: FormGroup = this.fb.group({
    code: ['', [Validators.required, Validators.minLength(3)]],
    discount_percentage: [20, [Validators.required, Validators.min(1), Validators.max(100)]],
    tipo: ['cumpleaños', [Validators.required]],
    fecha_inicio: [null],
    fecha_fin: [null],
    fecha_especifica: [null]
  });

  mensajeFeedback = signal<string>('');
  esError = signal<boolean>(false);
  mostrarModalExito = signal<boolean>(false);

  get tipoSeleccionado(): string {
    return this.cuponForm.get('tipo')?.value;
  }

  async crearCupon() {
    this.mensajeFeedback.set('');

    if (this.cuponForm.invalid) {
      this.cuponForm.markAllAsTouched();
      this.esError.set(true);
      this.mensajeFeedback.set('Por favor, completa los campos requeridos correctamente.');
      return;
    }

    const formValues = this.cuponForm.value;

    // Asignamos por defecto min_age = 50 para todos los cupones creados por el admin
    const nuevoCupon = {
      code: formValues.code.trim().toUpperCase(),
      discount_percentage: Number(formValues.discount_percentage),
      tipo: formValues.tipo,
      is_welcome: false, // Ya no se crean de bienvenida desde aqui
      min_age: 50,       // Por regla de negocio, aplican a mayores de 50
      fecha_inicio: formValues.tipo === 'entre_fechas' ? formValues.fecha_inicio : null,
      fecha_fin: formValues.tipo === 'entre_fechas' ? formValues.fecha_fin : null,
      fecha_especifica: formValues.tipo === 'fecha_especial' ? formValues.fecha_especifica : null
    };

    const { error } = await this.couponService.crearCupon(nuevoCupon);

    if (error) {
      this.esError.set(true);
      this.mensajeFeedback.set('Error al crear el cupón: ' + error.message);
    } else {
      this.esError.set(false);
      this.mensajeFeedback.set('¡Cupón creado con éxito!');
      this.mostrarModalExito.set(true);
      
      this.cuponForm.reset({
        code: '',
        discount_percentage: 20,
        tipo: 'cumpleaños',
        fecha_inicio: null,
        fecha_fin: null,
        fecha_especifica: null
      });

      this.couponCreated.emit();
    }
  }

  cerrarModal() {
    this.mostrarModalExito.set(false);
  }
}
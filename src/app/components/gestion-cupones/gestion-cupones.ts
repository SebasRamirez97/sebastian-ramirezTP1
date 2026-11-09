import { Component, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CrearCuponComponent } from '../crear-cupon/crear-cupon';
import { TablaCuponesComponent } from '../tabla-cupones/tabla-cupones';

@Component({
  selector: 'app-gestion-cupones',
  standalone: true,
  imports: [CommonModule, CrearCuponComponent, TablaCuponesComponent],
  templateUrl: './gestion-cupones.html',
  styleUrls: ['./gestion-cupones.css']
})
export class GestionCuponesComponent {
  // Referencia moderna con viewChild para invocar el método de recarga del componente hijo
  private tablaCupones = viewChild.required(TablaCuponesComponent);

  refrescarTabla(): void {
    this.tablaCupones().cargarCupones();
  }
}
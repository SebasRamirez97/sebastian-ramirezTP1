import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { PropuestasService, PropuestaPelicula } from '../../services/propuestas.service';

@Component({
  selector: 'app-admin-propuestas',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-propuestas.html',
  styleUrl: './admin-propuestas.css',
})
export class AdminPropuestasComponent implements OnInit {
  private propuestasService = inject(PropuestasService);
  private router = inject(Router);

  propuestas = signal<PropuestaPelicula[]>([]);
  cargando = signal<boolean>(true);
  errorMsg = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    await this.cargar();
  }

  async cargar(): Promise<void> {
    this.cargando.set(true);
    this.errorMsg.set(null);
    try {
      const lista = await this.propuestasService.getTodasLasPropuestas();
      this.propuestas.set(lista);
    } catch (e: any) {
      this.errorMsg.set(e.message);
    } finally {
      this.cargando.set(false);
    }
  }

  async aceptarYCrearPelicula(propuesta: PropuestaPelicula): Promise<void> {
    try {
      await this.propuestasService.aceptarPropuesta(propuesta.id);
      await this.router.navigate(['/armar-cartelera'], {
        queryParams: {
          nombre: propuesta.titulo,
          sinopsis: propuesta.descripcion,
          propuestaId: propuesta.id,
        },
        state: {
          peliculaPrecargada: {
            nombre: propuesta.titulo,
            sinopsis: propuesta.descripcion,
          },
        },
      });
    } catch (e: any) {
      this.errorMsg.set(e.message);
    }
  }

  async rechazar(propuesta: PropuestaPelicula): Promise<void> {
    try {
      await this.propuestasService.rechazarPropuesta(propuesta.id);
      await this.cargar();
    } catch (e: any) {
      this.errorMsg.set(e.message);
    }
  }
}
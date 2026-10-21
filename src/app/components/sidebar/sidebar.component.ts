import { Component, OnInit, OnDestroy, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.css']
})
export class SidebarComponent implements OnInit, OnDestroy {
  // 🔹 Inyección moderna con inject()
  private authService = inject(AuthService);
  private router = inject(Router);

  // 🔹 Estado de rol manejado con Signals
  rol = signal<string>('');
  private rolSub!: Subscription;

  ngOnInit(): void {
    // 🔹 Escucha los cambios de rol en tiempo real desde AuthService
    this.rolSub = this.authService.rol$.subscribe((nuevoRol) => {
      this.rol.set(nuevoRol);
    });
  }

  ngOnDestroy(): void {
    // 🔹 Limpieza de la suscripción para evitar fugas de memoria (Memory Leaks)
    if (this.rolSub) {
      this.rolSub.unsubscribe();
    }
  }

  async cerrarSesion(): Promise<void> {
    await this.authService.signOut();
    this.router.navigate(['/login']);
  }

  salirAnonimo(): void {
    this.authService.signOutAnonimo();
    this.router.navigate(['/login']);
  }
}
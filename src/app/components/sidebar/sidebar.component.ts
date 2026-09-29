import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../../services/auth.service'; // 👈 Ajusta la ruta a tu servicio

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.css']
})
export class SidebarComponent implements OnInit, OnDestroy {
  rol: string = '';
  private rolSub!: Subscription;

  constructor(private authService: AuthService, private router: Router) {}

  ngOnInit() {
    // 🔹 Escucha los cambios de rol en tiempo real directamente desde AuthService
    this.rolSub = this.authService.rol$.subscribe((nuevoRol) => {
      this.rol = nuevoRol;
    });
  }

  ngOnDestroy() {
    // 🔹 Cancela la suscripción al destruir el componente
    if (this.rolSub) {
      this.rolSub.unsubscribe();
    }
  }

  async cerrarSesion() {
    await this.authService.signOut();
    this.router.navigate(['/login']);
  }

  salirAnonimo() {
    this.authService.signOutAnonimo();
    this.router.navigate(['/login']);
  }
}
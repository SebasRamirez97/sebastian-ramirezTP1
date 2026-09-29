import { Component } from '@angular/core';
import { RouterOutlet, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { SidebarComponent } from './components/sidebar/sidebar.component'; // 👈 Ajusta la ruta a tu componente

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, SidebarComponent],
  templateUrl: './app.html',
  styleUrls: ['./app.css']
})
export class AppComponent {

  constructor(private router: Router) {}

  mostrarSidebar(): boolean {
    const rutaActual = this.router.url;
    return !rutaActual.includes('/login') && !rutaActual.includes('/register');
  }
}
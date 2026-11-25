import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { RouterOutlet, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { supabase } from './services/supabaseClient';
import { ProximamenteService } from './services/proximamente.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, SidebarComponent],
  templateUrl: './app.html',
  styleUrls: ['./app.css']
})
export class AppComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private proximamenteService = inject(ProximamenteService);
  private authSubscription: { unsubscribe: () => void } | null = null;

  async ngOnInit(): Promise<void> {
    const { data } = await supabase.auth.getUser();
    if (data?.user?.id) {
      this.proximamenteService.iniciarMonitoreoGlobal(data.user.id);
    }

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      const userId = session?.user?.id;
      if (userId) {
        this.proximamenteService.iniciarMonitoreoGlobal(userId);
      } else {
        this.proximamenteService.detenerMonitoreoGlobal();
      }
    });

    this.authSubscription = authListener.subscription;
  }

  ngOnDestroy(): void {
    this.authSubscription?.unsubscribe();
    this.proximamenteService.detenerMonitoreoGlobal();
  }

  mostrarSidebar(): boolean {
    const rutaActual = this.router.url;
    return !rutaActual.includes('/login') && !rutaActual.includes('/register');
  }
}
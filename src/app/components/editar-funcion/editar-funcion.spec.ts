import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EditarFuncion } from './editar-funcion';

describe('EditarFuncion', () => {
  let component: EditarFuncion;
  let fixture: ComponentFixture<EditarFuncion>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EditarFuncion],
    }).compileComponents();

    fixture = TestBed.createComponent(EditarFuncion);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

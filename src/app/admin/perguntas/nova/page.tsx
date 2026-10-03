'use client';

import { useState } from 'react';
import Card, { CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

export default function NovaPerguntaPage() {
  const router = useRouter();
  
  const [formData, setFormData] = useState({
    tipo: 'PROVA',
    tema: '',
    pergunta: '',
    altA: '', expA: '',
    altB: '', expB: '',
    altC: '', expC: '',
    altD: '', expD: '',
    altE: '', expE: '',
    correta: 'A',
    expCorreta: '',
    ativa: true
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.tema || !formData.pergunta || !formData.altA || !formData.altB) {
      toast.error('Preencha os campos obrigatórios.');
      return;
    }
    toast.success('Pergunta salva com sucesso!');
    router.push('/admin/perguntas');
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = type === 'checkbox' ? (e.target as HTMLInputElement).checked : undefined;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-secondary">Nova Pergunta</h1>
        <Link href="/admin/perguntas">
          <Button variant="outline">Voltar</Button>
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Dados Básicos</CardTitle>
          </CardHeader>
          <div className="p-4 pt-0 grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select 
              label="Tipo de Avaliação" 
              name="tipo" 
              value={formData.tipo} 
              onChange={handleChange}
              options={[{value: 'PROVA', label: 'Prova'}, {value: 'SIMULADO', label: 'Simulado'}]}
            />
            <Select 
              label="Tema / Dimensão" 
              name="tema" 
              value={formData.tema} 
              onChange={handleChange}
              options={[{value: '', label: 'Selecione...'}, {value: 'Internet', label: 'Internet Básica'}]}
            />
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Enunciado da Pergunta *</label>
              <textarea 
                name="pergunta"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent min-h-[100px]"
                value={formData.pergunta}
                onChange={handleChange}
                required
              />
            </div>
            <div className="md:col-span-2 flex items-center mt-2">
              <input 
                type="checkbox" 
                name="ativa" 
                id="ativa" 
                checked={formData.ativa} 
                onChange={handleChange} 
                className="mr-2"
              />
              <label htmlFor="ativa" className="text-sm font-medium text-gray-700">Pergunta Ativa (disponível para sorteio)</label>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Alternativas</CardTitle>
          </CardHeader>
          <div className="p-4 pt-0 space-y-6">
            <div className="md:w-1/3">
              <Select 
                label="Alternativa Correta *" 
                name="correta" 
                value={formData.correta} 
                onChange={handleChange}
                options={[
                  {value: 'A', label: 'A'}, {value: 'B', label: 'B'}, 
                  {value: 'C', label: 'C'}, {value: 'D', label: 'D'}, {value: 'E', label: 'E'}
                ]}
              />
            </div>
            
            <div className="mb-4">
               <label className="block text-sm font-medium text-gray-700 mb-1">Explicação Geral (mostrada quando acerta)</label>
               <textarea 
                name="expCorreta"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm min-h-[60px]"
                value={formData.expCorreta}
                onChange={handleChange}
              />
            </div>

            {['A', 'B', 'C', 'D', 'E'].map((letra) => (
              <div key={letra} className={`p-4 border rounded-md ${formData.correta === letra ? 'border-green-300 bg-green-50' : 'border-gray-200'}`}>
                <div className="flex items-center mb-2">
                  <span className={`font-bold mr-2 ${formData.correta === letra ? 'text-green-600' : 'text-gray-700'}`}>
                    Alternativa {letra} {formData.correta === letra && '(Correta)'}
                  </span>
                </div>
                <div className="space-y-4">
                  <Input 
                    label="Texto da Alternativa *"
                    name={`alt${letra}`} 
                    value={(formData as any)[`alt${letra}`]} 
                    onChange={handleChange}
                    required={letra === 'A' || letra === 'B'}
                  />
                  <div className="mt-2">
                    <label className="block text-xs text-gray-500 mb-1">Explicação específica (opcional, mostrada se aluno errar escolhendo esta)</label>
                    <textarea 
                      name={`exp${letra}`}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm min-h-[50px]"
                      value={(formData as any)[`exp${letra}`]}
                      onChange={handleChange}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <div className="flex justify-end space-x-4">
          <Link href="/admin/perguntas">
            <Button variant="outline" type="button">Cancelar</Button>
          </Link>
          <Button variant="primary" type="submit">Salvar Pergunta</Button>
        </div>
      </form>
    </div>
  );
}

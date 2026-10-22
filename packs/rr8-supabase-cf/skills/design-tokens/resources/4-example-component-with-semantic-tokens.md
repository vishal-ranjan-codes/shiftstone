## 4. Example Component with Semantic Tokens

```tsx
import { Card, CardHeader, CardTitle, CardContent } from "~/components/ui/card";

export function MetricCard({ title, value, change }: { title: string; value: string; change: string }) {
  return (
    <Card className="theme-card-bg theme-border-color border">
      <CardHeader className="pb-2">
        <p className="text-sm font-medium theme-fc-light">{title}</p>
        <CardTitle className="text-2xl font-bold theme-fc-heading">{value}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
          {change} from last month
        </p>
      </CardContent>
    </Card>
  );
}
```

---

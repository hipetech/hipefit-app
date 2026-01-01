import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { AlertCircle, Info } from 'lucide-react-native';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/ui/accordion';
import { Alert, AlertDescription, AlertTitle } from '@/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/ui/alert-dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/ui/avatar';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/ui/card';
import { Checkbox } from '@/ui/checkbox';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/ui/dialog';
import { Input } from '@/ui/input';
import { Label } from '@/ui/label';
import { Progress } from '@/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/ui/select';
import { Separator } from '@/ui/separator';
import { Skeleton } from '@/ui/skeleton';
import { Switch } from '@/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui/tabs';
import { Text } from '@/ui/text';
import { Textarea } from '@/ui/textarea';

export default function TestingScreen() {
  const [switchValue, setSwitchValue] = useState(false);
  const [checkboxValue, setCheckboxValue] = useState(false);
  const [radioValue, setRadioValue] = useState('option1');
  const [progressValue, setProgressValue] = useState(60);
  const [tabValue, setTabValue] = useState('tab1');

  return (
    <ScrollView className="flex-1 bg-background">
      <View className="gap-6 p-4">
        {/* Header */}
        <View className="gap-2">
          <Text variant="h1">Component Showcase</Text>
          <Text variant="muted">Test and preview all UI components</Text>
        </View>

        <Separator />

        {/* Typography Section */}
        <Section title="Typography">
          <Text variant="h1">Heading 1</Text>
          <Text variant="h2">Heading 2</Text>
          <Text variant="h3">Heading 3</Text>
          <Text variant="h4">Heading 4</Text>
          <Text variant="p">Paragraph text</Text>
          <Text variant="lead">Lead text</Text>
          <Text variant="large">Large text</Text>
          <Text variant="small">Small text</Text>
          <Text variant="muted">Muted text</Text>
          <Text variant="code">Code text</Text>
          <Text variant="blockquote">Blockquote text</Text>
        </Section>

        <Separator />

        {/* Buttons Section */}
        <Section title="Buttons">
          <View className="gap-3">
            <Button variant="default">
              <Text>Default Button</Text>
            </Button>
            <Button variant="secondary">
              <Text>Secondary Button</Text>
            </Button>
            <Button variant="destructive">
              <Text>Destructive Button</Text>
            </Button>
            <Button variant="outline">
              <Text>Outline Button</Text>
            </Button>
            <Button variant="ghost">
              <Text>Ghost Button</Text>
            </Button>
            <Button variant="link">
              <Text>Link Button</Text>
            </Button>
            <View className="flex-row gap-2">
              <Button size="sm">
                <Text>Small</Text>
              </Button>
              <Button size="default">
                <Text>Default</Text>
              </Button>
              <Button size="lg">
                <Text>Large</Text>
              </Button>
            </View>
          </View>
        </Section>

        <Separator />

        {/* Badges Section */}
        <Section title="Badges">
          <View className="flex-row flex-wrap gap-2">
            <Badge variant="default">
              <Text>Default</Text>
            </Badge>
            <Badge variant="secondary">
              <Text>Secondary</Text>
            </Badge>
            <Badge variant="destructive">
              <Text>Destructive</Text>
            </Badge>
            <Badge variant="outline">
              <Text>Outline</Text>
            </Badge>
          </View>
        </Section>

        <Separator />

        {/* Cards Section */}
        <Section title="Cards">
          <Card>
            <CardHeader>
              <CardTitle>Card Title</CardTitle>
              <CardDescription>Card description goes here</CardDescription>
            </CardHeader>
            <CardContent>
              <Text>
                This is the card content area where you can put any components.
              </Text>
            </CardContent>
            <CardFooter>
              <Button variant="outline">
                <Text>Action</Text>
              </Button>
            </CardFooter>
          </Card>
        </Section>

        <Separator />

        {/* Form Inputs Section */}
        <Section title="Form Inputs">
          <View className="gap-4">
            <View className="gap-2">
              <Label nativeID="input-demo">Input Field</Label>
              <Input
                placeholder="Enter text here..."
                aria-labelledby="input-demo"
              />
            </View>

            <View className="gap-2">
              <Label nativeID="textarea-demo">Textarea</Label>
              <Textarea
                placeholder="Enter multiple lines..."
                aria-labelledby="textarea-demo"
              />
            </View>

            <View className="flex-row items-center gap-3">
              <Switch checked={switchValue} onCheckedChange={setSwitchValue} />
              <Label nativeID="switch-demo">Enable notifications</Label>
            </View>

            <View className="flex-row items-center gap-3">
              <Checkbox
                checked={checkboxValue}
                onCheckedChange={setCheckboxValue}
              />
              <Label nativeID="checkbox-demo">
                Accept terms and conditions
              </Label>
            </View>

            <View className="gap-2">
              <Label>Radio Group</Label>
              <RadioGroup value={radioValue} onValueChange={setRadioValue}>
                <View className="flex-row items-center gap-2">
                  <RadioGroupItem
                    value="option1"
                    aria-labelledby="option1-label"
                  />
                  <Label nativeID="option1-label">Option 1</Label>
                </View>
                <View className="flex-row items-center gap-2">
                  <RadioGroupItem
                    value="option2"
                    aria-labelledby="option2-label"
                  />
                  <Label nativeID="option2-label">Option 2</Label>
                </View>
                <View className="flex-row items-center gap-2">
                  <RadioGroupItem
                    value="option3"
                    aria-labelledby="option3-label"
                  />
                  <Label nativeID="option3-label">Option 3</Label>
                </View>
              </RadioGroup>
            </View>

            <View className="gap-2">
              <Label>Select</Label>
              <Select defaultValue={{ value: 'apple', label: 'Apple' }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a fruit" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Fruits</SelectLabel>
                    <SelectItem label="Apple" value="apple">
                      Apple
                    </SelectItem>
                    <SelectItem label="Banana" value="banana">
                      Banana
                    </SelectItem>
                    <SelectItem label="Orange" value="orange">
                      Orange
                    </SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </View>
          </View>
        </Section>

        <Separator />

        {/* Avatar Section */}
        <Section title="Avatars">
          <View className="flex-row gap-3">
            <Avatar alt="User avatar">
              <AvatarImage
                source={{
                  uri: 'https://api.dicebear.com/7.x/avataaars/png?seed=1',
                }}
              />
              <AvatarFallback>
                <Text>JD</Text>
              </AvatarFallback>
            </Avatar>
            <Avatar alt="User avatar" className="h-16 w-16">
              <AvatarImage
                source={{
                  uri: 'https://api.dicebear.com/7.x/avataaars/png?seed=2',
                }}
              />
              <AvatarFallback>
                <Text>AB</Text>
              </AvatarFallback>
            </Avatar>
            <Avatar alt="Fallback only">
              <AvatarFallback>
                <Text>XY</Text>
              </AvatarFallback>
            </Avatar>
          </View>
        </Section>

        <Separator />

        {/* Progress Section */}
        <Section title="Progress">
          <View className="gap-4">
            <View className="gap-2">
              <Text variant="small">Progress: {progressValue}%</Text>
              <Progress value={progressValue} max={100} />
            </View>
            <View className="flex-row gap-2">
              <Button
                size="sm"
                onPress={() =>
                  setProgressValue(Math.max(0, progressValue - 10))
                }
              >
                <Text>-10</Text>
              </Button>
              <Button
                size="sm"
                onPress={() =>
                  setProgressValue(Math.min(100, progressValue + 10))
                }
              >
                <Text>+10</Text>
              </Button>
            </View>
          </View>
        </Section>

        <Separator />

        {/* Alerts Section */}
        <Section title="Alerts">
          <View className="gap-3">
            <Alert icon={Info}>
              <AlertTitle>Default Alert</AlertTitle>
              <AlertDescription>
                This is a default alert message.
              </AlertDescription>
            </Alert>
            <Alert icon={AlertCircle} variant="destructive">
              <AlertTitle>Error Alert</AlertTitle>
              <AlertDescription>
                This is a destructive alert message.
              </AlertDescription>
            </Alert>
          </View>
        </Section>

        <Separator />

        {/* Accordion Section */}
        <Section title="Accordion">
          <Accordion type="multiple" collapsible className="w-full gap-2">
            <AccordionItem value="item-1">
              <AccordionTrigger>
                <Text>Section 1</Text>
              </AccordionTrigger>
              <AccordionContent>
                <Text>Content for section 1 goes here.</Text>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-2">
              <AccordionTrigger>
                <Text>Section 2</Text>
              </AccordionTrigger>
              <AccordionContent>
                <Text>Content for section 2 goes here.</Text>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-3">
              <AccordionTrigger>
                <Text>Section 3</Text>
              </AccordionTrigger>
              <AccordionContent>
                <Text>Content for section 3 goes here.</Text>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </Section>

        <Separator />

        {/* Tabs Section */}
        <Section title="Tabs">
          <Tabs value={tabValue} onValueChange={setTabValue} className="w-full">
            <TabsList className="w-full flex-row">
              <TabsTrigger value="tab1" className="flex-1">
                <Text>Tab 1</Text>
              </TabsTrigger>
              <TabsTrigger value="tab2" className="flex-1">
                <Text>Tab 2</Text>
              </TabsTrigger>
              <TabsTrigger value="tab3" className="flex-1">
                <Text>Tab 3</Text>
              </TabsTrigger>
            </TabsList>
            <TabsContent value="tab1">
              <Card>
                <CardHeader>
                  <CardTitle>Tab 1 Content</CardTitle>
                </CardHeader>
                <CardContent>
                  <Text>This is the content for tab 1.</Text>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="tab2">
              <Card>
                <CardHeader>
                  <CardTitle>Tab 2 Content</CardTitle>
                </CardHeader>
                <CardContent>
                  <Text>This is the content for tab 2.</Text>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="tab3">
              <Card>
                <CardHeader>
                  <CardTitle>Tab 3 Content</CardTitle>
                </CardHeader>
                <CardContent>
                  <Text>This is the content for tab 3.</Text>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </Section>

        <Separator />

        {/* Dialogs Section */}
        <Section title="Dialogs">
          <View className="gap-3">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Text>Open Dialog</Text>
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Dialog Title</DialogTitle>
                  <DialogDescription>
                    This is a dialog description. You can put any content here.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline">
                      <Text>Close</Text>
                    </Button>
                  </DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">
                  <Text>Open Alert Dialog</Text>
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete
                    your data.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>
                    <Text>Cancel</Text>
                  </AlertDialogCancel>
                  <AlertDialogAction>
                    <Text>Continue</Text>
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </View>
        </Section>

        <Separator />

        {/* Skeleton Section */}
        <Section title="Skeleton Loaders">
          <View className="gap-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-32 w-full" />
            <View className="flex-row gap-2">
              <Skeleton className="h-12 w-12 rounded-full" />
              <View className="flex-1 gap-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </View>
            </View>
          </View>
        </Section>

        {/* Bottom padding */}
        <View className="h-8" />
      </View>
    </ScrollView>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View className="gap-3">
      <Text variant="h3">{title}</Text>
      <View className="gap-2">{children}</View>
    </View>
  );
}
